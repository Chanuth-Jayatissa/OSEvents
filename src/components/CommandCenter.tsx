import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ChevronRight, Zap, FileText, Camera, Mail, Search, DollarSign, Shield, Send, Palette } from "lucide-react";
import Icosahedron from "./Icosahedron";
import { useEventBus } from "@/contexts/EventBusContext";
import { toast } from "sonner";

interface AgentCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  tools: {
    id: string;
    name: string;
    description: string;
  }[];
}

const agentCategories: AgentCategory[] = [
  {
    id: "marketing",
    name: "Marketing Factory",
    icon: Camera,
    tools: [
      { id: "image", name: "Image Sub-agent", description: "Creative Designer — Stable Diffusion on Vultr A40" },
      { id: "video", name: "Video Sub-agent", description: "Cinematic Creator — CogVideoX on Vultr A40" },
    ],
  },
  {
    id: "sponsor",
    name: "Sponsor Scout",
    icon: Search,
    tools: [
      { id: "scraper", name: "Web Scraper", description: "Playwright + Google CSE — finds companies" },
      { id: "tier", name: "Tier Matcher", description: "Gemini Flash + openpyxl — assigns sponsor tiers" },
    ],
  },
  {
    id: "project_manager",
    name: "Project Manager",
    icon: FileText,
    tools: [
      { id: "timeline", name: "Timeline Builder", description: "Gemini Flash + python-dateutil — builds Gantt timelines" },
    ],
  },
  {
    id: "communication",
    name: "Communications",
    icon: Mail,
    tools: [
      { id: "discord", name: "Discord Sub-agent", description: "discord.py — creates servers, sends messages, DMs" },
      { id: "email", name: "Email Sub-agent", description: "Gmail API — drafts & sends emails from your account" },
    ],
  },
  {
    id: "compliance",
    name: "Compliance Shield",
    icon: Shield,
    tools: [
      { id: "rules", name: "Rule Extractor", description: "PyPDF2 + Gemini Flash — extracts venue constraints" },
    ],
  },
  {
    id: "context",
    name: "Context Agent",
    icon: Search,
    tools: [
      { id: "researcher", name: "Web Researcher", description: "Playwright + Google CSE + Gemini — finds relevant context" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    icon: DollarSign,
    tools: [
      { id: "budget", name: "Budget Planner", description: "Gemini Flash + openpyxl — builds event budgets" },
      { id: "expense", name: "Expense Tracker", description: "Logs expenses, flags overruns" },
    ],
  },
];

const CommandCenter = () => {
  const {
    terminalLogs,
    clearLogs,
    activeAgents,
    activeSubAgents,
    isProcessing,
    activeAgentCount,
    sendGlobalCommand,
  } = useEventBus();

  const [selectedCategory, setSelectedCategory] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Auto-expand active agent categories
  useEffect(() => {
    if (activeAgents.size > 0) {
      const firstActive = [...activeAgents][0];
      if (agentCategories.find((c) => c.id === firstActive)) {
        setSelectedCategory(firstActive);
      }
    }
  }, [activeAgents]);

  const handleSendCommand = async () => {
    if (!commandInput.trim() || isProcessing) return;
    const prompt = commandInput;
    setCommandInput("");

    try {
      await sendGlobalCommand(prompt);
    } catch (error) {
      toast.error("Failed to send command", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  const getLogColor = (agent: string, level: string) => {
    if (agent === "USER") return "text-foreground font-bold drop-shadow-[0_0_8px_hsl(43_72%_55%_/_0.5)]";
    switch (level) {
      case "success": return "text-primary";
      case "warning": return "text-electric";
      case "error": return "text-destructive";
      default: return "text-brass-light";
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "--:--:--";
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Left Sidebar - Agent Navigator */}
      <div className="w-[300px] border-r border-border bg-card overflow-y-auto p-3 flex flex-col gap-2">
        <div className="px-2 py-1.5">
          <h3 className="font-heading text-sm text-primary tracking-wide">Agent Workflows</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            {isProcessing ? `${activeAgentCount} agents active` : "7 agents available"}
          </p>
        </div>

        {agentCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const isActive = activeAgents.has(cat.id);
          return (
            <div key={cat.id}>
              <motion.button
                onClick={() => setSelectedCategory(isSelected ? "" : cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border transition-all text-left ${
                  isActive
                    ? "agent-running border-primary bg-primary/10 shadow-[0_0_15px_hsl(43_72%_55%_/_0.3)]"
                    : isSelected
                    ? "border-primary/40 bg-primary/5 border-gold-glow"
                    : "border-border hover:border-brass/30 bg-transparent"
                }`}
                whileHover={{ scale: 1.01 }}
              >
                <cat.icon size={15} className={isActive || isSelected ? "text-primary" : "text-brass"} />
                <span className={`text-sm font-medium ${isActive ? "text-primary text-gold-glow" : isSelected ? "text-primary" : "text-foreground"}`}>
                  {cat.name}
                </span>
                {isActive && (
                  <span className="ml-auto text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
                {!isActive && (
                  <ChevronRight
                    size={12}
                    className={`ml-auto transition-transform text-muted-foreground ${isSelected ? "rotate-90" : ""}`}
                  />
                )}
              </motion.button>

              {(isSelected || isActive) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-3 mt-1 space-y-1 border-l border-brass/20 pl-3"
                >
                  {cat.tools.map((tool) => {
                    const isSubActive = activeSubAgents.has(tool.id);
                    return (
                      <div key={tool.id}>
                        <div className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                          isSubActive
                            ? "subagent-active text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <Zap size={10} className={isSubActive ? "text-primary animate-spin" : "text-primary"} />
                            {tool.name}
                            {isSubActive && (
                              <span className="text-[8px] font-mono text-primary bg-primary/15 px-1 py-0.5 rounded animate-pulse ml-auto">
                                RUNNING
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground px-2.5 py-1 leading-relaxed font-mono">
                          {tool.description}
                        </p>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Center Stage */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with actions */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-brass" />
            <span className="text-xs text-muted-foreground font-mono">LIVE TERMINAL</span>
            {isProcessing && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                PROCESSING
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground">
              {terminalLogs.length} events
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brass/40 text-brass text-xs hover:border-primary/40 hover:text-primary transition-colors"
            >
              <RefreshCw size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Terminal View */}
        <div ref={terminalRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
          {terminalLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-3">
              <Icosahedron size={40} spinning={false} />
              <p className="text-sm">Enter a command to get started</p>
              <p className="text-[10px]">Try: "Find 10 tech sponsors and generate a hype video"</p>
            </div>
          )}

          {terminalLogs.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.02 }}
              className="flex gap-3 py-1"
            >
              <span className="text-muted-foreground shrink-0">{formatTime(line.timestamp)}</span>
              <span className={`shrink-0 w-32 ${getLogColor(line.agent_name, line.level)}`}>
                [{line.agent_name}]
              </span>
              <span className="text-foreground/80">{line.message}</span>
            </motion.div>
          ))}

          {/* Blinking cursor */}
          {!isProcessing && terminalLogs.length > 0 && (
            <div className="flex items-center gap-2 py-1 text-muted-foreground">
              <span className="animate-pulse">▊</span>
              <span className="text-brass/40">awaiting next directive...</span>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 py-1 text-primary">
              <Icosahedron size={14} spinning />
              <span className="text-primary/60 animate-pulse">agents working...</span>
            </div>
          )}
        </div>
      
        {/* Bottom Command Bar */}
        <div className="p-4 bg-card border-t border-border mt-auto shrink-0 z-40">
          <div className="bg-background border border-border rounded-full px-4 py-2.5 flex items-center gap-3 shadow-lg" style={{ boxShadow: "0 4px 20px hsl(0 0% 0% / 0.5)" }}>
            <Icosahedron size={22} spinning={isProcessing} />
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell the agents what to do next..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              disabled={isProcessing}
            />
            <button
              onClick={handleSendCommand}
              disabled={isProcessing || !commandInput.trim()}
              className="p-1.5 rounded-full hover:bg-primary/10 transition-colors disabled:opacity-30"
            >
              <Send size={16} className="text-primary" />
            </button>
            <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {isProcessing ? `${activeAgentCount} active` : "7 agents"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
