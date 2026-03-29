"""
EventOS Orchestrator — Dispatches agents in parallel via asyncio.gather().
Manages log queues for SSE streaming and writes results to MongoDB.
"""

import asyncio
import uuid
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult, CommandResponse
from backend.db import database

# Active log queues keyed by command_id
_log_queues: dict[str, asyncio.Queue] = {}

# Store completed results keyed by command_id
_results: dict[str, list[AgentResult]] = {}


def get_log_queue(command_id: str) -> asyncio.Queue | None:
    """Get the log queue for a command. Returns None if not found."""
    return _log_queues.get(command_id)


class PersistentLogQueue(asyncio.Queue):
    def __init__(self, project_id: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.project_id = project_id

    async def put(self, logItem: AgentLog):
        # Attach project ID
        logItem.project_id = self.project_id
        
        # Don't persist the DONE sentinel — it's only an SSE control signal
        if logItem.message != "DONE":
            # Insert into MongoDB in the background
            # Do not block the fast put() for SSE streams
            async def _save():
                try:
                    await database.insert_document("terminal_logs", logItem.model_dump())
                except Exception as e:
                    print(f"Failed to save terminal log: {e}")
                    
            asyncio.create_task(_save())
        await super().put(logItem)


def create_log_queue(command_id: str, project_id: str) -> asyncio.Queue:
    """Create a new log queue for a command."""
    queue = PersistentLogQueue(project_id)
    _log_queues[command_id] = queue
    return queue


def cleanup_command(command_id: str):
    """Remove a command's queue and results from memory."""
    _log_queues.pop(command_id, None)
    _results.pop(command_id, None)


async def _run_single_agent(
    agent_fn,
    intent: str,
    params: dict,
    project_id: str,
    log_queue: asyncio.Queue,
    original_prompt: str,
) -> AgentResult | None:
    """Run a single agent function, catching errors gracefully."""
    try:
        from backend.core.refinement import refine_agent_output

        # Agents that produce structured JSON data suitable for critique
        AGENTS_TO_REFINE = {
            "plan_budget",
            "match_tiers",
            "build_timeline",
            "extract_rules",
            "research_context"
        }

        if intent in AGENTS_TO_REFINE:
            result = await refine_agent_output(
                agent_fn=agent_fn,
                params=params,
                log_queue=log_queue,
                project_id=project_id,
                original_prompt=original_prompt,
                max_rounds=5,
            )
        else:
            # Pass params and log_queue to the agent directly
            result = await agent_fn(params=params, log_queue=log_queue, project_id=project_id)
            
        return result
    except Exception as e:
        error_log = AgentLog(
            timestamp=datetime.utcnow(),
            agent_name=intent.upper(),
            domain="orchestrator",
            message=f"Agent '{intent}' failed with error: {str(e)}",
            level="error",
        )
        await log_queue.put(error_log)
        return AgentResult(
            agent_name=intent,
            domain="orchestrator",
            status="error",
            collection="agent_logs",
            data={"error": str(e), "intent": intent},
            logs=[error_log],
        )


async def execute(prompt: str, project_id: str = "default") -> CommandResponse:
    """
    Main orchestration flow:
    1. Instantly return a CommandResponse so frontend connects to SSE.
    2. In background: Call Master Brain to extract intents.
    3. Look up agent functions from the registry.
    4. Fire all matched agents in parallel via asyncio.gather().
    5. Collect results and write to MongoDB.
    """
    command_id = str(uuid.uuid4())
    log_queue = create_log_queue(command_id, project_id)

    # Automatically save user prompt into the DB terminal stream 
    await log_queue.put(AgentLog(
        agent_name="USER",
        domain="core",
        message=f"{prompt}",
        level="info"
    ))

    # Inform the stream that Master Brain is already listening
    await log_queue.put(AgentLog(
        agent_name="MASTER_BRAIN",
        domain="core",
        message=f"Analyzing directive...",
        level="info",
    ))

    # We return immediately, so intents are not known yet in the HTTP response body
    response = CommandResponse(
        command_id=command_id,
        intents=["analyzing"],
        agents_dispatched=[],
    )

    async def _run_all():
        from backend.core.master_brain import route
        from backend.agents import AGENT_REGISTRY

        try:
            # --- AUTO-RENAME PROJECT LOGIC ---
            project_db = await database.get_one_document("projects", {"id": project_id})
            is_default_name = project_db and project_db.get("name") in ["Untitled Project", "default", "New Project"]
            
            if is_default_name:
                import os
                api_key = os.getenv("GEMINI_API_KEY")
                if api_key:
                    try:
                        from google import genai
                        client = genai.Client(api_key=api_key)
                        rename_prompt = f"Generate a short, Title Cased project name (2-5 words) based on this user request: '{prompt}'. Return ONLY the name."
                        response = client.models.generate_content(
                            model="gemini-3.1-pro-preview",
                            contents=rename_prompt,
                            config=genai.types.GenerateContentConfig(temperature=0.3, max_output_tokens=20),
                        )
                        new_name = response.text.strip().replace('"', '')
                        
                        if new_name:
                            await database.update_document("projects", {"id": project_id}, {"name": new_name})
                            await log_queue.put(AgentLog(
                                agent_name="MASTER_BRAIN",
                                domain="core",
                                message=f"Auto-assigned project name: {new_name}",
                                level="success",
                            ))
                    except Exception as e:
                        print(f"Failed to auto-rename project: {e}")
            # ---------------------------------

            # Step 1: Route the prompt (Master Brain "thinking")
            routing_result = await route(prompt, project_id)
            intents = routing_result.get("intents", [])
            params = routing_result.get("params", {})

            await log_queue.put(AgentLog(
                agent_name="MASTER_BRAIN",
                domain="core",
                message=f"Detected {len(intents)} intent(s): {', '.join(intents)}",
                level="success",
            ))

            # Step 2: Match intents to agent functions
            agents_to_run = []
            agents_dispatched = []

            for intent in intents:
                # If conversational response, handle directly here
                if intent == "respond_user":
                    response_text = params.get("respond_user", {}).get("response", "I don't have an answer.")
                    await log_queue.put(AgentLog(
                        agent_name="MASTER_BRAIN",
                        domain="core",
                        message=response_text,
                        level="success",
                    ))
                    continue

                if intent in AGENT_REGISTRY:
                    agent_fn = AGENT_REGISTRY[intent]
                    intent_params = params.get(intent, {})
                    agents_to_run.append((agent_fn, intent, intent_params))
                    agents_dispatched.append(intent)

                    await log_queue.put(AgentLog(
                        agent_name="ORCHESTRATOR",
                        domain="core",
                        message=f"Dispatching agent: {intent}",
                        level="info",
                    ))
                    if intent_params:
                        import json
                        await log_queue.put(AgentLog(
                            agent_name="ORCHESTRATOR",
                            domain="core",
                            message=f"Task parameters: {json.dumps(intent_params, default=str)}",
                            level="info",
                        ))
                else:
                    await log_queue.put(AgentLog(
                        agent_name="ORCHESTRATOR",
                        domain="core",
                        message=f"⚠ No agent registered for intent: {intent}",
                        level="warning",
                    ))

            # Step 3: Fire underlying agents in parallel
            if agents_to_run:
                tasks = [
                    _run_single_agent(fn, intent, intent_params, project_id, log_queue, prompt)
                    for fn, intent, intent_params in agents_to_run
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Step 4: Process results — write to MongoDB
                for result in results:
                    if isinstance(result, AgentResult) and result.status == "success":
                        try:
                            await database.insert_document(
                                result.collection,
                                result.data,
                            )
                            await log_queue.put(AgentLog(
                                agent_name=result.agent_name,
                                domain=result.domain,
                                message=f"Result saved to '{result.collection}' collection",
                                level="success",
                            ))
                        except Exception as e:
                            await log_queue.put(AgentLog(
                                agent_name=result.agent_name,
                                domain=result.domain,
                                message=f"Failed to save result: {e}",
                                level="error",
                            ))
                    elif isinstance(result, Exception):
                        await log_queue.put(AgentLog(
                            agent_name="ORCHESTRATOR",
                            domain="core",
                            message=f"Agent raised exception: {result}",
                            level="error",
                        ))

                _results[command_id] = [r for r in results if isinstance(r, AgentResult)]
                
            # Signal completion
            if agents_to_run:
                await log_queue.put(AgentLog(
                    agent_name="ORCHESTRATOR",
                    domain="core",
                    message="All agents completed. Awaiting next directive.",
                    level="success",
                ))
            else:
                await log_queue.put(AgentLog(
                    agent_name="ORCHESTRATOR",
                    domain="core",
                    message="Master Brain responded. Awaiting next directive.",
                    level="info",
                ))

            # Sentinel to close SSE stream
            await log_queue.put(AgentLog(
                agent_name="SYSTEM",
                domain="core",
                message="DONE",
                level="info",
            ))

        except Exception as e:
            await log_queue.put(AgentLog(
                agent_name="ORCHESTRATOR",
                domain="core",
                message=f"Orchestration error: {e}",
                level="error",
            ))
            await log_queue.put(AgentLog(
                agent_name="SYSTEM",
                domain="core",
                message="DONE",
                level="info",
            ))

    # Launch the background task immediately before returning
    asyncio.create_task(_run_all())

    return response
