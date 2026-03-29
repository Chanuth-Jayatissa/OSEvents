"""
EventOS Backend — FastAPI Application
Main entry point with all REST + SSE endpoints.
"""

import os
import asyncio
import uuid
import shutil
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sse_starlette.sse import EventSourceResponse

from backend.core.contracts import CommandRequest, CommandResponse, AgentLog
from backend.core.orchestrator import execute, get_log_queue, create_log_queue
from backend.core.auth import get_google_auth_url, handle_google_callback, get_current_user, FRONTEND_URL
from backend.db import database


# ──────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 EventOS Backend starting...")
    connected = await database.ping_db()
    if not connected:
        print("⚠️  Running without MongoDB — some features will be limited")

    # Seed a default project if none exists
    try:
        projects = await database.get_documents("projects", {})
        if not projects:
            await database.insert_document("projects", {
                "id": "default",
                "name": "GDG_ANNUAL_GALA_2026",
                "event_type": "gala",
                "attendee_count": 2000,
                "status": "planning",
                "created_at": datetime.utcnow().isoformat(),
            })
            print("📁 Seeded default project: GDG_ANNUAL_GALA_2026")
    except Exception as e:
        print(f"⚠️  Could not seed default project: {e}")

    yield

    # Shutdown
    print("👋 EventOS Backend shutting down...")


# ──────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────

app = FastAPI(
    title="EventOS API",
    description="Multi-agent event management platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "EventOS", "timestamp": datetime.utcnow().isoformat()}


# ──────────────────────────────────────────────
# Authentication (Google OAuth)
# ──────────────────────────────────────────────

@app.get("/api/auth/google/login")
async def google_login():
    """Returns the Google OAuth consent URL."""
    url = get_google_auth_url()
    return {"url": url}


@app.get("/api/auth/google/callback")
async def google_callback(code: str):
    """Handles the Google OAuth callback — exchanges code for tokens."""
    try:
        result = await handle_google_callback(code)
        # Redirect to frontend with the JWT token as a query param
        token = result["token"]
        return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={token}")
    except Exception as e:
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error={str(e)}")


@app.get("/api/auth/me")
async def auth_me(authorization: str = Header(default="")):
    """Returns the current authenticated user."""
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.post("/api/auth/logout")
async def auth_logout():
    """Client-side logout — just acknowledge the request."""
    return {"message": "Logged out"}


# ──────────────────────────────────────────────
# Command Center
# ──────────────────────────────────────────────

@app.post("/api/command", response_model=CommandResponse)
async def send_command(request: CommandRequest):
    """Send a user prompt to the Master Brain for routing and agent dispatch."""
    response = await execute(request.prompt, request.project_id)
    return response


@app.get("/api/stream/{command_id}")
async def stream_logs(command_id: str):
    """SSE endpoint — streams AgentLog events from a running command."""

    async def event_generator():
        queue = get_log_queue(command_id)
        if queue is None:
            # If the queue doesn't exist yet, wait briefly and retry
            await asyncio.sleep(0.5)
            queue = get_log_queue(command_id)

        if queue is None:
            yield {
                "event": "error",
                "data": '{"message": "Command not found"}',
            }
            return

        heartbeat_interval = 15
        last_heartbeat = asyncio.get_event_loop().time()

        while True:
            try:
                # Wait for a log event with timeout for heartbeat
                log = await asyncio.wait_for(queue.get(), timeout=heartbeat_interval)

                if log.message == "DONE":
                    yield {
                        "event": "complete",
                        "data": '{"message": "All agents completed"}',
                    }
                    return

                yield {
                    "event": "log",
                    "data": log.model_dump_json(),
                }

            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                yield {
                    "event": "heartbeat",
                    "data": '{"ping": true}',
                }

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# Assets (The Vault)
# ──────────────────────────────────────────────

@app.get("/api/assets")
async def get_assets(project_id: str = "default"):
    """Fetch all generated assets."""
    try:
        assets = await database.get_documents("assets", {"project_id": project_id})
        return assets
    except Exception:
        return []


# ──────────────────────────────────────────────
# Leads (Sponsor Hub)
# ──────────────────────────────────────────────

@app.get("/api/leads")
async def get_leads(project_id: str = "default"):
    """Fetch all sponsor leads."""
    try:
        # Leads might be stored individually or as a batch
        leads_docs = await database.get_documents("leads", {"project_id": project_id})
        # Flatten if stored as batches
        all_leads = []
        for doc in leads_docs:
            if "leads" in doc and isinstance(doc["leads"], list):
                all_leads.extend(doc["leads"])
            else:
                all_leads.append(doc)
        return all_leads
    except Exception:
        return []


# ──────────────────────────────────────────────
# Roadmap (Logistics)
# ──────────────────────────────────────────────

@app.get("/api/roadmap")
async def get_roadmap(project_id: str = "default"):
    """Fetch milestones and tasks."""
    try:
        roadmap = await database.get_one_document("roadmap", {"project_id": project_id})
        if roadmap:
            return {
                "milestones": roadmap.get("milestones", []),
                "tasks": roadmap.get("tasks", []),
            }
        return {"milestones": [], "tasks": []}
    except Exception:
        return {"milestones": [], "tasks": []}


# ──────────────────────────────────────────────
# Rules (Compliance)
# ──────────────────────────────────────────────

@app.get("/api/rules")
async def get_rules(project_id: str = "default"):
    """Fetch extracted compliance constraints."""
    try:
        rule_docs = await database.get_documents("rules", {"project_id": project_id})
        all_rules = []
        for doc in rule_docs:
            if "rules" in doc and isinstance(doc["rules"], list):
                all_rules.extend(doc["rules"])
            else:
                all_rules.append(doc)
        return all_rules
    except Exception:
        return []


# ──────────────────────────────────────────────
# Budgets (Finance)
# ──────────────────────────────────────────────

@app.get("/api/budgets/{project_id}")
async def get_budget(project_id: str):
    """Fetch budget and expense data."""
    try:
        budget = await database.get_one_document("budgets", {"project_id": project_id})
        if budget:
            return budget
        return {"project_id": project_id, "total_budget": 0, "total_spent": 0, "categories": []}
    except Exception:
        return {"project_id": project_id, "total_budget": 0, "total_spent": 0, "categories": []}


# ──────────────────────────────────────────────
# Projects
# ──────────────────────────────────────────────

@app.get("/api/projects")
async def get_projects():
    """List all projects/missions."""
    try:
        projects = await database.get_documents("projects", {})
        return projects
    except Exception:
        return [{"id": "default", "name": "GDG_ANNUAL_GALA_2026", "status": "planning"}]


# ──────────────────────────────────────────────
# File Upload (for Compliance Agent)
# ──────────────────────────────────────────────

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), project_id: str = "default"):
    """Upload a PDF for the Compliance Agent to process."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Save the file
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Trigger the compliance agent
    response = await execute(
        f"Extract rules from uploaded document: {file.filename}",
        project_id,
    )

    # Also directly trigger rule extraction with the file path
    from backend.core.orchestrator import create_log_queue
    from backend.agents.compliance import rule_extractor

    command_id = str(uuid.uuid4())
    log_queue = create_log_queue(command_id)

    asyncio.create_task(
        rule_extractor(
            params={"file_path": file_path, "project_id": project_id},
            log_queue=log_queue,
            project_id=project_id,
        )
    )

    return {
        "message": f"File '{file.filename}' uploaded and processing started",
        "command_id": command_id,
        "file_path": file_path,
    }
