import { useState, useEffect } from "react";
import { Terminal, Archive, Map, Gem, ChevronDown, Database, User, DollarSign, LogOut, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useEventBus } from "@/contexts/EventBusContext";
import { createProject } from "@/lib/api";
import { toast } from "sonner";

interface NavigationBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "command", label: "Command Center", icon: Terminal },
  { id: "vault", label: "The Vault", icon: Archive },
  { id: "logistics", label: "Logistics", icon: Map },
  { id: "sponsors", label: "Sponsor Hub", icon: Gem },
  { id: "finance", label: "Finance", icon: DollarSign },
];

const NavigationBar = ({ activeTab, onTabChange }: NavigationBarProps) => {
  const [missionOpen, setMissionOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState("hackathon");
  const [newProjectAttendees, setNewProjectAttendees] = useState(500);
  const { user, logout } = useAuth();
  const {
    projects,
    activeProjectId,
    setActiveProject,
    refreshProjects,
    tabNotifications,
    clearNotification,
    isProcessing,
  } = useEventBus();

  // Load projects on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeProjectName = activeProject?.name || "No Project Selected";

  const handleTabChange = (tabId: string) => {
    clearNotification(tabId);
    onTabChange(tabId);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName, newProjectType, newProjectAttendees);
      toast.success("Project created!", { description: project.name });
      setActiveProject(project.id);
      await refreshProjects();
      setNewProjectName("");
      setShowNewProject(false);
      setMissionOpen(false);
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  const handleSelectProject = (id: string) => {
    setActiveProject(id);
    setMissionOpen(false);
  };

  return (
    <>
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
              <span className="font-mono text-xs text-primary">{activeProjectName}</span>
              <ChevronDown size={12} className="text-primary/60" />
            </div>
            <AnimatePresence>
              {missionOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-2 w-72 border border-primary/30 bg-card rounded-md shadow-lg overflow-hidden"
                >
                  {projects.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                      No projects yet. Create one below.
                    </div>
                  )}
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className={`px-3 py-2 font-mono text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        p.id === activeProjectId
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                      onClick={(e) => { e.stopPropagation(); handleSelectProject(p.id); }}
                    >
                      <div>
                        <span className="block">{p.name}</span>
                        {p.event_type && (
                          <span className="text-[9px] text-muted-foreground">{p.event_type} • {p.attendee_count ?? 0} attendees</span>
                        )}
                      </div>
                      {p.id === activeProjectId && (
                        <span className="text-[8px] text-primary bg-primary/15 px-1.5 py-0.5 rounded">ACTIVE</span>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-border">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowNewProject(true); setMissionOpen(false); }}
                      className="w-full px-3 py-2.5 flex items-center gap-2 text-xs text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Plus size={12} /> New Project
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex-1 flex justify-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const hasNotification = tabNotifications[tab.id] && !isActive;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                  isActive
                    ? "text-primary text-gold-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <tab.icon size={16} />
                  {hasNotification ? (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full tab-notification-dot" />
                  ) : (
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                        isActive ? "bg-primary animate-pulse-gold" : "bg-brass/40"
                      }`}
                    />
                  )}
                </div>
                <span className="hidden lg:inline">{tab.label}</span>
                {tab.id === "command" && isProcessing && (
                  <span className="text-[8px] font-mono text-primary bg-primary/15 px-1.5 py-0.5 rounded-full animate-pulse">
                    LIVE
                  </span>
                )}
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
          <Database size={14} className="text-brass" />
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-full border border-primary/50 flex items-center justify-center overflow-hidden"
              style={{ boxShadow: "0 0 6px hsl(43 72% 55% / 0.2)" }}
            >
              {user?.picture ? (
                <img src={user.picture} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={14} className="text-primary" />
              )}
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 w-64 border border-primary/30 bg-card rounded-md shadow-lg overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{user?.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{user?.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full px-3 py-2 text-xs text-left text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={12} /> Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProject && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-obsidian/60 backdrop-blur-sm"
              onClick={() => setShowNewProject(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[420px] bg-card border border-primary/30 rounded-xl p-6 shadow-lg"
              style={{ boxShadow: "0 0 40px hsl(43 72% 55% / 0.1)" }}
            >
              <h2 className="font-heading text-lg text-primary mb-4">Create New Project</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1.5">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. GrizzHacks 2026"
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1.5">Event Type</label>
                  <select
                    value={newProjectType}
                    onChange={(e) => setNewProjectType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-md text-foreground outline-none focus:border-primary/40 transition-colors"
                  >
                    <option value="hackathon">Hackathon</option>
                    <option value="conference">Conference</option>
                    <option value="gala">Gala</option>
                    <option value="workshop">Workshop</option>
                    <option value="meetup">Meetup</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1.5">Expected Attendees</label>
                  <input
                    type="number"
                    value={newProjectAttendees}
                    onChange={(e) => setNewProjectAttendees(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm bg-muted border border-border rounded-md text-foreground outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 px-4 py-2.5 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-30"
                  style={{ boxShadow: "0 0 20px hsl(43 72% 55% / 0.3)" }}
                >
                  <Plus size={14} /> Create
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NavigationBar;
