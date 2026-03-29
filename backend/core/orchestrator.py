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


def create_log_queue(command_id: str) -> asyncio.Queue:
    """Create a new log queue for a command."""
    queue = asyncio.Queue()
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
) -> AgentResult | None:
    """Run a single agent function, catching errors gracefully."""
    try:
        # Pass params and log_queue to the agent
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
    1. Call Master Brain to extract intents
    2. Look up agent functions from the registry
    3. Fire all matched agents in parallel via asyncio.gather()
    4. Collect results and write to MongoDB
    5. Return the CommandResponse immediately (agents run in background)
    """
    from backend.core.master_brain import route
    from backend.agents import AGENT_REGISTRY

    command_id = str(uuid.uuid4())
    log_queue = create_log_queue(command_id)

    # Step 1: Route the prompt
    await log_queue.put(AgentLog(
        agent_name="MASTER_BRAIN",
        domain="core",
        message=f"Analyzing prompt: \"{prompt[:80]}{'...' if len(prompt) > 80 else ''}\"",
        level="info",
    ))

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
        else:
            await log_queue.put(AgentLog(
                agent_name="ORCHESTRATOR",
                domain="core",
                message=f"⚠ No agent registered for intent: {intent}",
                level="warning",
            ))

    # Step 3: Create the response immediately
    response = CommandResponse(
        command_id=command_id,
        intents=intents,
        agents_dispatched=agents_dispatched,
    )

    # Step 4: Fire agents in parallel (background task)
    async def _run_all():
        try:
            if agents_to_run:
                tasks = [
                    _run_single_agent(fn, intent, intent_params, project_id, log_queue)
                    for fn, intent, intent_params in agents_to_run
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Step 5: Process results — write to MongoDB
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
            await log_queue.put(AgentLog(
                agent_name="ORCHESTRATOR",
                domain="core",
                message="All agents completed. Awaiting next directive.",
                level="success",
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

    # Launch the background task
    asyncio.create_task(_run_all())

    return response
