import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { AgentLog, sendCommand, streamLogs, Project, fetchProjects, CommandResponse, fetchTerminalLogs, deleteTerminalLogs } from "@/lib/api";

// ── Agent name → panel ID mapping ──
const AGENT_TO_CATEGORY: Record<string, string> = {
  MASTER_BRAIN: "master",
  ORCHESTRATOR: "orchestrator",
  MARKETING: "marketing",
  CREATIVE_DESIGNER: "marketing",
  CINEMATIC_CREATOR: "marketing",
  IMAGE_SUBAGENT: "marketing",
  VIDEO_SUBAGENT: "marketing",
  SPONSOR_SCOUT: "sponsor",
  WEB_SCRAPER: "sponsor",
  TIER_MATCHER: "sponsor",
  PROJECT_MANAGER: "project_manager",
  TIMELINE_BUILDER: "project_manager",
  COMMUNICATION: "communication",
  DISCORD_SUBAGENT: "communication",
  EMAIL_SUBAGENT: "communication",
  COMPLIANCE: "compliance",
  RULE_EXTRACTOR: "compliance",
  CONTEXT: "context",
  WEB_RESEARCHER: "context",
  FINANCE: "finance",
  BUDGET_PLANNER: "finance",
  EXPENSE_TRACKER: "finance",
};

const AGENT_TO_SUBAGENT: Record<string, string> = {
  CREATIVE_DESIGNER: "image",
  CINEMATIC_CREATOR: "video",
  IMAGE_SUBAGENT: "image",
  VIDEO_SUBAGENT: "video",
  WEB_SCRAPER: "scraper",
  TIER_MATCHER: "tier",
  TIMELINE_BUILDER: "timeline",
  DISCORD_SUBAGENT: "discord",
  EMAIL_SUBAGENT: "email",
  RULE_EXTRACTOR: "rules",
  WEB_RESEARCHER: "researcher",
  BUDGET_PLANNER: "budget",
  EXPENSE_TRACKER: "expense",
};

// Which tab gets notified when a given domain/agent finishes
const AGENT_TO_TAB: Record<string, string> = {
  MARKETING: "vault",
  CREATIVE_DESIGNER: "vault",
  CINEMATIC_CREATOR: "vault",
  SPONSOR_SCOUT: "sponsors",
  PROJECT_MANAGER: "logistics",
  COMPLIANCE: "logistics",
  FINANCE: "finance",
  BUDGET_PLANNER: "finance",
};

interface EventBusContextType {
  // Terminal
  terminalLogs: AgentLog[];
  addLog: (log: AgentLog) => void;
  clearLogs: () => void;

  // Agent status
  activeAgents: Set<string>;
  activeSubAgents: Set<string>;
  isProcessing: boolean;

  // Tab notifications
  tabNotifications: Record<string, boolean>;
  setTabNotification: (tabId: string, value: boolean) => void;
  clearNotification: (tabId: string) => void;

  // Projects
  activeProjectId: string;
  projects: Project[];
  setActiveProject: (id: string) => void;
  refreshProjects: () => Promise<void>;

  // Command
  sendGlobalCommand: (prompt: string) => Promise<CommandResponse | null>;
  activeAgentCount: number;
}

const EventBusContext = createContext<EventBusContextType>({
  terminalLogs: [],
  addLog: () => {},
  clearLogs: () => {},
  activeAgents: new Set(),
  activeSubAgents: new Set(),
  isProcessing: false,
  tabNotifications: {},
  setTabNotification: () => {},
  clearNotification: () => {},
  activeProjectId: "default",
  projects: [],
  setActiveProject: () => {},
  refreshProjects: async () => {},
  sendGlobalCommand: async () => null,
  activeAgentCount: 0,
});

export const useEventBus = () => useContext(EventBusContext);

export const EventBusProvider = ({ children }: { children: ReactNode }) => {
  const [terminalLogs, setTerminalLogs] = useState<AgentLog[]>([]);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [activeSubAgents, setActiveSubAgents] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgentCount, setActiveAgentCount] = useState(0);
  const [tabNotifications, setTabNotifications] = useState<Record<string, boolean>>({});
  const [activeProjectId, setActiveProjectId] = useState("default");
  const [projects, setProjects] = useState<Project[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const addLog = useCallback((log: AgentLog) => {
    setTerminalLogs((prev) => [...prev, log]);

    // Track which agents/subagents are active
    const agentName = log.agent_name?.toUpperCase() || "";
    const categoryId = AGENT_TO_CATEGORY[agentName];
    const subAgentId = AGENT_TO_SUBAGENT[agentName];

    if (categoryId) {
      setActiveAgents((prev) => new Set(prev).add(categoryId));
    }
    if (subAgentId) {
      setActiveSubAgents((prev) => new Set(prev).add(subAgentId));
    }

    // Set tab notifications for result-producing agents
    const tabId = AGENT_TO_TAB[agentName];
    if (tabId && log.level === "success") {
      setTabNotifications((prev) => ({ ...prev, [tabId]: true }));
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await deleteTerminalLogs(activeProjectId);
      setTerminalLogs([]);
    } catch (error) {
      console.error("Failed to delete terminal logs", error);
    }
  }, [activeProjectId]);

  // Load historical logs when project switches
  useEffect(() => {
    if (!activeProjectId) return;
    
    // Reset active states
    setActiveAgents(new Set());
    setActiveSubAgents(new Set());
    
    // Fetch DB history
    fetchTerminalLogs(activeProjectId)
      .then(logs => {
        setTerminalLogs(logs);
      })
      .catch(err => {
        console.error("Failed to load terminal history", err);
        setTerminalLogs([]);
      });
      
    // Cleanup any running SSE streams on project switch
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, [activeProjectId]);

  const setTabNotification = useCallback((tabId: string, value: boolean) => {
    setTabNotifications((prev) => ({ ...prev, [tabId]: value }));
  }, []);

  const clearNotification = useCallback((tabId: string) => {
    setTabNotifications((prev) => ({ ...prev, [tabId]: false }));
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const fetched = await fetchProjects();
      setProjects(fetched);
      // If active project doesn't exist in the list, switch to first
      if (fetched.length > 0 && !fetched.find((p) => p.id === activeProjectId)) {
        setActiveProjectId(fetched[0].id);
      }
    } catch {
      console.error("Failed to fetch projects");
    }
  }, [activeProjectId]);

  const sendGlobalCommand = useCallback(
    async (prompt: string): Promise<CommandResponse | null> => {
      if (isProcessing) return null;

      setIsProcessing(true);
      setActiveAgents(new Set());
      setActiveSubAgents(new Set());

      try {
        const response = await sendCommand(prompt, activeProjectId);

        // Close existing SSE if any
        if (cleanupRef.current) cleanupRef.current();

        // Open SSE stream
        cleanupRef.current = streamLogs(
          response.command_id,
          (log) => {
            addLog(log);
          },
          () => {
            setIsProcessing(false);
            setActiveAgentCount(0);
            setActiveAgents(new Set());
            setActiveSubAgents(new Set());
          },
          () => {
            setIsProcessing(false);
            setActiveAgentCount(0);
            setActiveAgents(new Set());
            setActiveSubAgents(new Set());
          },
        );

        return response;
      } catch (error) {
        setIsProcessing(false);
        setActiveAgentCount(0);
        throw error;
      }
    },
    [isProcessing, activeProjectId, addLog],
  );

  return (
    <EventBusContext.Provider
      value={{
        terminalLogs,
        addLog,
        clearLogs,
        activeAgents,
        activeSubAgents,
        isProcessing,
        tabNotifications,
        setTabNotification,
        clearNotification,
        activeProjectId,
        projects,
        setActiveProject: setActiveProjectId,
        refreshProjects,
        sendGlobalCommand,
        activeAgentCount,
      }}
    >
      {children}
    </EventBusContext.Provider>
  );
};
