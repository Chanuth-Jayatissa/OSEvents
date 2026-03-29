"""
EventOS Refinement Loop — Master Brain ↔ Agent iterative review.

Wraps any agent function in a quality gate:  the agent produces a draft,
the Master Brain reviews it, and the agent refines until APPROVED or the
max round limit (default 5) is reached.

Only agents producing LLM-generated structured data should go through this.
Binary-output agents (image/video) and side-effect agents (email/discord)
are excluded at the orchestrator level.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Callable, Awaitable

from backend.core.contracts import AgentLog, AgentResult

try:
    from google import genai
except ImportError:
    genai = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        _client = genai.Client(api_key=api_key)
    return _client


REVIEWER_SYSTEM_PROMPT = """You are the EventOS Master Brain Reviewer — a quality-assurance layer.

You have just received the output produced by one of the domain agents.  Your job
is to evaluate the output for:
1. **Completeness** — Does the data cover all aspects requested?
2. **Accuracy** — Are dollar amounts, dates, names, and numbers realistic and consistent?
3. **Hallucination** — Is anything clearly fabricated, contradictory, or impossible?
4. **Formatting** — Does the JSON structure match the expected schema?

Respond with ONLY a valid JSON object:
{
  "verdict": "APPROVED" or "REFINE",
  "feedback": "If REFINE, explain exactly what is wrong and what needs to change. If APPROVED, leave empty.",
  "suggested_changes": "If REFINE, describe the specific corrections the agent should make."
}

Rules:
- IMPORTANT: The output does NOT need to be perfect. If it is relatively good and reasonable, return APPROVED immediately to stop the refinement loop early.
- If there are clear, major issues (missing critical data, highly unrealistic numbers, hallucinated errors), return REFINE with specific feedback.
- Be concise but specific in your feedback.
- Do not nitpick minor structural or stylistic issues. The goal is "good enough".
- After round 2, you MUST lower your bar significantly and approve unless there is a catastrophic factual problem.
"""


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    """Emit a log line to the SSE stream."""
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="core",
        message=msg,
        level=level,
    ))


async def _review_output(
    agent_name: str,
    original_prompt: str,
    output_data: dict,
    round_number: int,
    max_rounds: int,
    project_context: str = "",
) -> dict:
    """
    Ask the Master Brain to review an agent's output.
    Returns: {"verdict": "APPROVED"|"REFINE", "feedback": "...", "suggested_changes": "..."}
    """
    client = _get_client()

    # Truncate large outputs to stay within token limits
    output_json = json.dumps(output_data, indent=2, default=str)
    if len(output_json) > 12000:
        output_json = output_json[:12000] + "\n... [truncated]"

    review_prompt = f"""Agent: {agent_name}
Original user request context: {original_prompt}
Review round: {round_number}/{max_rounds}

SUPPORTING CONTEXT & CONSTRAINTS:
{project_context}

Agent output to review:
{output_json}

Remember: The output only needs to be "relatively good", not perfect. If we are on round 2 or higher, prioritize APPROVAL to stop the loop, unless there are fatal errors.
"""

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=review_prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=REVIEWER_SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=1024,
            response_mime_type="application/json",
        ),
    )

    try:
        return json.loads(response.text.strip())
    except json.JSONDecodeError:
        # If we can't parse the review, approve to avoid infinite loops
        return {"verdict": "APPROVED", "feedback": "", "suggested_changes": ""}


async def _refine_output(
    agent_name: str,
    original_output: dict,
    feedback: str,
    suggested_changes: str,
    original_params: dict,
    project_context: str = "",
) -> dict:
    """
    Ask the same LLM to refine the agent's output based on reviewer feedback.
    This is Option B (incremental refinement) — we pass the previous output +
    feedback and ask for corrections, not a full re-run.
    """
    client = _get_client()

    output_json = json.dumps(original_output, indent=2, default=str)
    if len(output_json) > 12000:
        output_json = output_json[:12000] + "\n... [truncated]"

    refine_prompt = f"""You are the {agent_name} agent. You previously produced the following output,
but the Master Brain reviewer has identified issues that need fixing.

SUPPORTING CONTEXT & CONSTRAINTS:
{project_context}

YOUR PREVIOUS OUTPUT:
{output_json}

REVIEWER FEEDBACK:
{feedback}

SUGGESTED CHANGES:
{suggested_changes}

ORIGINAL PARAMETERS:
{json.dumps(original_params, default=str)}

Please produce a CORRECTED version of the output. Return ONLY the corrected JSON data
(same schema as the original output). Fix the specific issues mentioned in the feedback
while preserving everything that was correct.
"""

    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents=refine_prompt,
        config=genai.types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )

    try:
        return json.loads(response.text.strip())
    except json.JSONDecodeError:
        # If refinement fails to parse, return original
        return original_output


async def refine_agent_output(
    agent_fn: Callable[..., Awaitable[AgentResult]],
    params: dict,
    log_queue: asyncio.Queue,
    project_id: str,
    original_prompt: str = "",
    max_rounds: int = 5,
    min_rounds: int = 2,
) -> AgentResult:
    """
    Execute an agent, then review its output with the Master Brain.
    If the reviewer says REFINE, incrementally improve the output and re-review.
    Repeats up to max_rounds times.

    Args:
        agent_fn:        The async agent function to call
        params:          Params dict to pass to the agent
        log_queue:       SSE log queue for real-time terminal output
        project_id:      Active project ID
        original_prompt: The user's original prompt (for review context)
        max_rounds:      Max review rounds (default 5)
        min_rounds:      Min review rounds (default 2)

    Returns:
        The final (possibly refined) AgentResult
    """
    # Step 1: Execute the agent normally to get the initial draft
    result = await agent_fn(params=params, log_queue=log_queue, project_id=project_id)

    # If the agent errored, skip refinement
    if result.status == "error":
        return result

    # If Gemini is not available, skip refinement
    if not genai:
        await _emit(log_queue, "MASTER_BRAIN",
                    f"Skipping review — Gemini SDK not available", "warning")
        return result

    agent_name = result.agent_name
    current_data = result.data

    # Step X: Gather contextual constraints and web research before refining
    from backend.db import database
    project_context_parts = []
    
    try:
        project_doc = await database.get_one_document("projects", {"id": project_id})
        if project_doc:
            project_context_parts.append(f"Project Details: Event={project_doc.get('event_type')}, Attendees={project_doc.get('attendee_count')}, Name={project_doc.get('name')}")
            
        budget_doc = await database.get_one_document("budgets", {"project_id": project_id})
        if budget_doc:
            project_context_parts.append(f"Budget Constraints: Total=${budget_doc.get('total_budget')}, Spent=${budget_doc.get('total_spent')}")
            
        rules_docs = await database.get_documents("rules", {"project_id": project_id})
        if rules_docs:
            rules_list = []
            for d in rules_docs:
                if "rules" in d and isinstance(d["rules"], list):
                    rules_list.extend(d["rules"])
                else:
                    rules_list.append(str(d))
            if rules_list:
                rules_text = "\n- ".join(rules_list[:10]) 
                if len(rules_list) > 10: rules_text += "\n- ... [truncated]"
                project_context_parts.append(f"Compliance Rules:\n- {rules_text}")
    except Exception as e:
        await _emit(log_queue, "MASTER_BRAIN", f"Failed to load DB context: {e}", "warning")

    if original_prompt and agent_name != "WEB_RESEARCHER":
        from backend.agents.context import web_researcher
        await _emit(log_queue, "MASTER_BRAIN", "Dispatching Context Agent to extract situation-specific facts...")
        try:
            research_result = await web_researcher({"query": original_prompt, "max_sources": 3}, log_queue, project_id)
            if research_result.status == "success" and "sources" in research_result.data:
                snippets = [f" - {s.get('title')}: {s.get('summary')}" for s in research_result.data.get("sources", [])]
                if snippets:
                    project_context_parts.append(f"Web Research regarding '{original_prompt}':\n" + "\n".join(snippets))
        except Exception as e:
             await _emit(log_queue, "MASTER_BRAIN", f"Web researcher failed: {e}", "warning")

    project_context_str = "\n\n".join(project_context_parts) if project_context_parts else "No additional project context found."

    for round_num in range(1, max_rounds + 1):
        await _emit(log_queue, "MASTER_BRAIN",
                    f"Reviewing {agent_name} output (round {round_num}/{max_rounds})...")

        try:
            review = await _review_output(
                agent_name=agent_name,
                original_prompt=original_prompt,
                output_data=current_data,
                round_number=round_num,
                max_rounds=max_rounds,
                project_context=project_context_str,
            )
        except Exception as e:
            await _emit(log_queue, "MASTER_BRAIN",
                        f"Review error (approving by default): {e}", "warning")
            break

        verdict = review.get("verdict", "APPROVED").upper()
        feedback = review.get("feedback", "")
        suggested_changes = review.get("suggested_changes", "")

        # Enforce minimum rounds
        if verdict == "APPROVED" and round_num < min_rounds:
            verdict = "REFINE"
            feedback = feedback or "Output is acceptable, but please do a self-review to enrich details or polish formatting."
            suggested_changes = suggested_changes or "Review your previous output and expand on any brief sections, ensure high realism, and perfect the structure."
            await _emit(log_queue, "MASTER_BRAIN",
                        f"Output is acceptable, but forcing refinement to hit minimum rounds ({round_num}/{min_rounds})", "info")

        if verdict == "APPROVED":
            if round_num == 1:
                await _emit(log_queue, "MASTER_BRAIN",
                            f"✓ {agent_name} output approved on first pass", "success")
            else:
                await _emit(log_queue, "MASTER_BRAIN",
                            f"✓ {agent_name} output approved after {round_num} rounds of refinement",
                            "success")
            break
        else:
            # REFINE
            await _emit(log_queue, "MASTER_BRAIN",
                        f"Refinement needed — Feedback: {feedback}",
                        "warning")
            await _emit(log_queue, "MASTER_BRAIN",
                        f"Task for agent: {suggested_changes}",
                        "info")

            if round_num == max_rounds:
                await _emit(log_queue, "MASTER_BRAIN",
                            f"Max refinement rounds reached — accepting current output",
                            "warning")
                break

            # Incrementally refine the output (Option B)
            await _emit(log_queue, agent_name,
                        f"Refining output based on Master Brain feedback (round {round_num + 1})...")

            try:
                refined_data = await _refine_output(
                    agent_name=agent_name,
                    original_output=current_data,
                    feedback=feedback,
                    suggested_changes=suggested_changes,
                    original_params=params,
                    project_context=project_context_str,
                )
                current_data = refined_data

                await _emit(log_queue, agent_name,
                            f"Refinement complete — resubmitting for review", "info")
            except Exception as e:
                await _emit(log_queue, agent_name,
                            f"Refinement error: {e} — keeping previous output", "warning")
                break

    # Update the result with the (possibly refined) data
    result.data = current_data
    return result
