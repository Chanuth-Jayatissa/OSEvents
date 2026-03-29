/**
 * EventOS Frontend API Client
 * Centralized module for all backend communication.
 */

// ── Types matching backend Pydantic contracts ──

export interface AgentLog {
  timestamp: string;
  agent_name: string;
  domain: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

export interface CommandRequest {
  prompt: string;
  project_id: string;
}

export interface CommandResponse {
  command_id: string;
  intents: string[];
  agents_dispatched: string[];
}

export interface Asset {
  id: string;
  type: "video" | "image" | "document";
  title: string;
  origin: string;
  url: string;
  thumbnail: string;
  meta: string;
  project_id: string;
}

export interface Lead {
  id: string;
  company: string;
  industry: string;
  contact: string;
  email: string;
  website: string;
  location: string;
  score: number;
  recommended_tier: string;
  estimated_value: number;
  status: "ready" | "loading" | "contacted" | "rejected";
  reasoning: string;
}

export interface Milestone {
  id: string;
  label: string;
  date: string;
  description: string;
  done: boolean;
  current?: boolean;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  priority: "normal" | "high" | "critical";
  category: string;
}

export interface RoadmapData {
  milestones: Milestone[];
  tasks: Task[];
}

export interface Rule {
  id: string;
  text: string;
  severity: "info" | "warning" | "critical";
  category: string;
  time_constraint?: { start: string; end: string } | null;
}

export interface BudgetCategory {
  name: string;
  estimated: number;
  actual: number;
  notes: string;
  subcategories?: { name: string; cost: number }[];
}

export interface Budget {
  project_id: string;
  total_budget: number;
  total_spent: number;
  categories: BudgetCategory[];
}

export interface Project {
  id: string;
  name: string;
  event_type?: string;
  attendee_count?: number;
  status: string;
}

// ── API Functions ──

const API_BASE = "/api";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("eventos_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Send a user prompt to the Master Brain for routing and agent dispatch. */
export async function sendCommand(prompt: string, projectId: string = "default"): Promise<CommandResponse> {
  return apiFetch<CommandResponse>("/command", {
    method: "POST",
    body: JSON.stringify({ prompt, project_id: projectId }),
  });
}

/**
 * Open an SSE stream for real-time agent logs.
 * Returns a cleanup function to close the connection.
 */
export function streamLogs(
  commandId: string,
  onLog: (log: AgentLog) => void,
  onComplete?: () => void,
  onError?: (error: Event) => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE}/stream/${commandId}`);

  eventSource.addEventListener("log", (event) => {
    try {
      const log: AgentLog = JSON.parse(event.data);
      onLog(log);
    } catch (e) {
      console.error("Failed to parse log event:", e);
    }
  });

  eventSource.addEventListener("complete", () => {
    eventSource.close();
    onComplete?.();
  });

  eventSource.addEventListener("heartbeat", () => {
    // Keep-alive, nothing to do
  });

  eventSource.onerror = (err) => {
    console.error("SSE error:", err);
    eventSource.close();
    onError?.(err);
  };

  return () => eventSource.close();
}

/** Fetch all generated assets from The Vault. */
export async function fetchAssets(projectId: string = "default"): Promise<Asset[]> {
  return apiFetch<Asset[]>(`/assets?project_id=${projectId}`);
}

/** Fetch all sponsor leads. */
export async function fetchLeads(projectId: string = "default"): Promise<Lead[]> {
  return apiFetch<Lead[]>(`/leads?project_id=${projectId}`);
}

/** Fetch the project roadmap (milestones + tasks). */
export async function fetchRoadmap(projectId: string = "default"): Promise<RoadmapData> {
  return apiFetch<RoadmapData>(`/roadmap?project_id=${projectId}`);
}

/** Fetch extracted compliance rules. */
export async function fetchRules(projectId: string = "default"): Promise<Rule[]> {
  return apiFetch<Rule[]>(`/rules?project_id=${projectId}`);
}

/** Fetch budget and expense data. */
export async function fetchBudgets(projectId: string = "default"): Promise<Budget> {
  return apiFetch<Budget>(`/budgets/${projectId}`);
}

/** List all projects/missions for the current user. */
export async function fetchProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects");
}

/** Create a new project. */
export async function createProject(
  name: string,
  eventType: string = "general",
  attendeeCount: number = 100,
): Promise<Project> {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, event_type: eventType, attendee_count: attendeeCount }),
  });
}

/** Delete a project by ID. */
export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
}

/** Upload a file (PDF) for compliance processing. */
export async function uploadFile(file: File, projectId: string = "default"): Promise<{ message: string; command_id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload?project_id=${projectId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Fetch historical terminal logs for a project. */
export async function fetchTerminalLogs(projectId: string): Promise<AgentLog[]> {
  return apiFetch<AgentLog[]>(`/projects/${projectId}/logs`);
}

/** Clear all terminal history for a project. */
export async function deleteTerminalLogs(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/logs`, { method: "DELETE" });
}
