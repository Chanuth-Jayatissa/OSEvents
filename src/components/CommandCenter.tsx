import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Edit3, CheckCircle, ChevronRight, Zap, FileText, Camera, Mail, Users, Palette } from "lucide-react";
import Icosahedron from "./Icosahedron";

interface AgentCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  tools: {
    id: string;
    name: string;
    active: boolean;
    status: string;
  }[];
}

const agentCategories: AgentCategory[] = [
  {
    id: "content",
    name: "Content Engine",
    icon: FileText,
    tools: [
      { id: "copywriter", name: "Copywriter Agent", active: true, status: "Drafting keynote intro script — analyzing speaker bio for tone matching..." },
      { id: "designer", name: "Visual Designer", active: false, status: "Idle — awaiting content approval" },
    ],
  },
  {
    id: "media",
    name: "Media Production",
    icon: Camera,
    tools: [
      { id: "video", name: "Video Renderer", active: true, status: "Rendering 4K promo reel — frame 847/2400 — ETA 3m 22s" },
      { id: "photo", name: "Photo Editor", active: false, status: "Batch processing 48 venue photos" },
    ],
  },
  {
    id: "outreach",
    name: "Outreach & Comms",
    icon: Mail,
    tools: [
      { id: "email", name: "Email Drafter", active: true, status: "Composing VIP invitation — personalizing for 12 recipients..." },
      { id: "social", name: "Social Scheduler", active: false, status: "Queued: 6 posts for next 48h" },
    ],
  },
  {
    id: "logistics",
    name: "Crew & Logistics",
    icon: Users,
    tools: [
      { id: "venue", name: "Venue Coordinator", active: false, status: "Floor plan v3 approved — generating seating chart" },
      { id: "brand", name: "Brand Inspector", active: true, status: "Scanning assets for brand compliance — 94% pass rate" },
    ],
  },
];

const terminalLines = [
  { time: "14:32:01", agent: "COPYWRITER", msg: "Keynote script draft v2 complete — 1,847 words", type: "success" },
  { time: "14:32:04", agent: "VIDEO_RENDER", msg: "GPU cluster allocated — 4x A100 — rendering at 60fps", type: "info" },
  { time: "14:32:07", agent: "EMAIL_DRAFT", msg: "VIP template personalization: Sarah Chen → Tech Lead context loaded", type: "info" },
  { time: "14:32:09", agent: "BRAND_CHECK", msg: "⚠ Logo placement on banner_v4.png violates 20px margin rule", type: "warning" },
  { time: "14:32:12", agent: "SOCIAL_SCHED", msg: "Instagram carousel queued — 6 slides — publish: Mar 30, 9:00 AM", type: "success" },
  { time: "14:32:15", agent: "VIDEO_RENDER", msg: "Frame 847/2400 complete — estimated completion: 14:35:24", type: "info" },
];

const CommandCenter = () => {
  const [selectedCategory, setSelectedCategory] = useState("content");
  const [commandInput, setCommandInput] = useState("");

  const activeAgents = 7;

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Left Sidebar - Agent Navigator */}
      <div className="w-[300px] border-r border-border bg-card overflow-y-auto p-3 flex flex-col gap-2">
        <div className="px-2 py-1.5">
          <h3 className="font-heading text-sm text-primary tracking-wide">Agent Workflows</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{activeAgents} agents active</p>
        </div>

        {agentCategories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <div key={cat.id}>
              <motion.button
                onClick={() => setSelectedCategory(isSelected ? "" : cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border transition-all text-left ${
                  isSelected
                    ? "border-primary/40 bg-primary/5 border-gold-glow"
                    : "border-border hover:border-brass/30 bg-transparent"
                }`}
                whileHover={{ scale: 1.01 }}
              >
                <cat.icon size={15} className={isSelected ? "text-primary" : "text-brass"} />
                <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {cat.name}
                </span>
                <ChevronRight
                  size={12}
                  className={`ml-auto transition-transform text-muted-foreground ${isSelected ? "rotate-90" : ""}`}
                />
              </motion.button>

              {isSelected && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-3 mt-1 space-y-1 border-l border-brass/20 pl-3"
                >
                  {cat.tools.map((tool) => (
                    <div key={tool.id}>
                      <div
                        className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                          tool.active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {tool.active && <Zap size={10} />}
                          {tool.name}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground px-2.5 py-1 leading-relaxed font-mono">
                        {tool.status}
                      </p>
                    </div>
                  ))}
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
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brass/40 text-brass text-xs hover:border-primary/40 hover:text-primary transition-colors">
              <RefreshCw size={12} /> Regenerate
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brass/40 text-brass text-xs hover:border-primary/40 hover:text-primary transition-colors">
              <Edit3 size={12} /> Edit
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all"
              style={{ boxShadow: "0 0 12px hsl(43 72% 55% / 0.3)" }}
            >
              <CheckCircle size={12} /> Finalize
            </button>
          </div>
        </div>

        {/* Terminal View */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
          {terminalLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-3 py-1"
            >
              <span className="text-muted-foreground shrink-0">{line.time}</span>
              <span className={`shrink-0 w-28 ${
                line.type === "success" ? "text-primary" : line.type === "warning" ? "text-electric" : "text-brass-light"
              }`}>
                [{line.agent}]
              </span>
              <span className="text-foreground/80">{line.msg}</span>
            </motion.div>
          ))}

          {/* Blinking cursor */}
          <div className="flex items-center gap-2 py-1 text-muted-foreground">
            <span className="animate-pulse">▊</span>
            <span className="text-brass/40">awaiting next directive...</span>
          </div>
        </div>
      </div>

      {/* Bottom Command Bar */}
      <div className="absolute bottom-4 left-[320px] right-4 z-40">
        <div className="glass-dark border border-border rounded-full px-4 py-2.5 flex items-center gap-3 shadow-lg" style={{ boxShadow: "0 -4px 30px hsl(0 0% 0% / 0.5)" }}>
          <Icosahedron size={22} spinning={true} />
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Tell the agents what to do next..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {activeAgents} agents
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
