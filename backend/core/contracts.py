"""
EventOS Shared Contracts — Pydantic models used across the entire backend.
All agents, the orchestrator, and the API layer import from this module.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional, Any
from datetime import datetime
import uuid


# ──────────────────────────────────────────────
# Agent Communication Models
# ──────────────────────────────────────────────

class AgentLog(BaseModel):
    """A single log line emitted by an agent during execution."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str = "default"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    agent_name: str          # e.g. "IMAGE_SUBAGENT"
    domain: str              # e.g. "marketing"
    message: str
    level: Literal["info", "success", "warning", "error"] = "info"


class AgentResult(BaseModel):
    """The final output returned by every sub-agent after execution."""
    agent_name: str
    domain: str
    status: Literal["success", "error"]
    collection: str          # MongoDB collection to write to
    data: dict               # The document to upsert
    logs: list[AgentLog] = []


class RefinementReview(BaseModel):
    """Review verdict from the Master Brain after inspecting agent output."""
    verdict: Literal["APPROVED", "REFINE"]
    feedback: str = ""
    refined_params: dict = {}
    round_number: int = 1


# ──────────────────────────────────────────────
# API Request / Response Models
# ──────────────────────────────────────────────

class CommandRequest(BaseModel):
    """Incoming request from the frontend Command Center chat bar."""
    prompt: str
    project_id: str = "default"


class CommandResponse(BaseModel):
    """Immediate response after dispatching agents."""
    command_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    intents: list[str] = []
    agents_dispatched: list[str] = []


# ──────────────────────────────────────────────
# Data Models (stored in MongoDB)
# ──────────────────────────────────────────────

class Asset(BaseModel):
    """Generated asset (image, video, document) stored in the assets collection."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["video", "image", "document"]
    title: str
    origin: str              # Which agent created it
    url: str = ""
    thumbnail: str = ""
    meta: str = ""           # e.g. "4K • 2:34 • MP4"
    project_id: str = "default"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Lead(BaseModel):
    """Sponsor lead stored in the leads collection."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company: str
    industry: str
    contact: str = ""
    email: str = ""
    website: str = ""
    location: str = ""
    score: int = 0           # Match score 0-100
    recommended_tier: str = ""
    estimated_value: float = 0.0
    status: Literal["ready", "loading", "contacted", "rejected"] = "loading"
    reasoning: str = ""
    project_id: str = "default"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Milestone(BaseModel):
    """A single milestone in the project roadmap."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    date: str
    description: str = ""
    done: bool = False
    current: bool = False


class Task(BaseModel):
    """A single task in the execution checklist."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    done: bool = False
    priority: Literal["normal", "high", "critical"] = "normal"
    category: str = ""


class Roadmap(BaseModel):
    """Full roadmap stored in the roadmap collection."""
    project_id: str = "default"
    milestones: list[Milestone] = []
    tasks: list[Task] = []


class Rule(BaseModel):
    """An extracted constraint from a venue contract."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    severity: Literal["info", "warning", "critical"] = "info"
    category: str = "other"
    time_constraint: Optional[dict] = None  # {"start": "...", "end": "..."}
    project_id: str = "default"
    source_file: str = ""


class BudgetCategory(BaseModel):
    """A single budget category."""
    name: str
    estimated: float = 0.0
    actual: float = 0.0
    notes: str = ""
    subcategories: list[dict] = []


class Budget(BaseModel):
    """Full budget stored in the budgets collection."""
    project_id: str = "default"
    total_budget: float = 0.0
    total_spent: float = 0.0
    categories: list[BudgetCategory] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(BaseModel):
    """A project / mission."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    event_type: str = "hackathon"
    attendee_count: int = 0
    status: Literal["planning", "active", "completed"] = "planning"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContextDocument(BaseModel):
    """Research context gathered by the Context Agent."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str = "default"
    topic: str
    sources: list[dict] = []  # [{url, title, summary, key_points, relevance_score}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
