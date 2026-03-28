import { useState } from "react";
import { Terminal, Archive, Map, Gem, ChevronDown, Database, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavigationBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "command", label: "Command Center", icon: Terminal },
  { id: "vault", label: "The Vault", icon: Archive },
  { id: "logistics", label: "Logistics", icon: Map },
  { id: "sponsors", label: "Sponsor Hub", icon: Gem },
];

const NavigationBar = ({ activeTab, onTabChange }: NavigationBarProps) => {
  const [missionOpen, setMissionOpen] = useState(false);
  const gpuUsage = 73;

  return (
    <nav className="h-14 border-b border-border bg-card flex items-center px-4 relative z-50">
      {/* Left: Brand */}
      <div className="flex items-center gap-3 min-w-[280px]">
        <span className="font-heading text-xl text-primary tracking-wide">EventOS</span>
        <div className="w-px h-6 bg-primary/40" />
        <div
          className="cursor-pointer group relative"
          onClick={() => setMissionOpen(!missionOpen)}
        >
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block leading-none">
            Active Mission
          </span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs text-primary">GDG_ANNUAL_GALA_2026</span>
            <ChevronDown size={12} className="text-primary/60" />
          </div>
          <AnimatePresence>
            {missionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-2 w-64 border border-primary/30 bg-card rounded-md shadow-lg overflow-hidden"
              >
                {["GDG_ANNUAL_GALA_2026", "TECH_SUMMIT_Q3", "DEVFEST_2026"].map((m) => (
                  <div
                    key={m}
                    className="px-3 py-2 font-mono text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
                  >
                    {m}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center: Tabs */}
      <div className="flex-1 flex justify-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                isActive
                  ? "text-primary text-gold-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <tab.icon size={16} />
                <span
                  className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-primary animate-pulse-gold" : "bg-brass/40"
                  }`}
                />
              </div>
              <span className="hidden lg:inline">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  style={{ boxShadow: "0 0 8px hsl(43 72% 55% / 0.5)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right: HUD */}
      <div className="flex items-center gap-4 min-w-[200px] justify-end">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">GPU</span>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${gpuUsage}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
          <span className="font-mono text-[10px] text-primary">{gpuUsage}%</span>
        </div>
        <Database size={14} className="text-brass" />
        <div className="w-8 h-8 rounded-full border border-primary/50 flex items-center justify-center" style={{ boxShadow: "0 0 6px hsl(43 72% 55% / 0.2)" }}>
          <User size={14} className="text-primary" />
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;
