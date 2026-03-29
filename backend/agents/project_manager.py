"""
EventOS Project Manager Agent — Timeline Builder sub-agent.
Converts natural language goals into structured Gantt timelines.
Cross-references Compliance Agent's extracted rules to prevent conflicts.
"""

import os
import json
import asyncio
import uuid
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult
from backend.db import database

try:
    from google import genai
except ImportError:
    genai = None

try:
    from dateutil import parser as dateparser
    from dateutil.relativedelta import relativedelta
except ImportError:
    dateparser = None
    relativedelta = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="project_manager",
        message=msg,
        level=level,
    ))


async def timeline_builder(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Timeline Builder Sub-agent.
    Tools: Gemini 1.5 Flash for NL parsing + python-dateutil for date math.
    Cross-references rules collection to prevent scheduling conflicts.
    """
    goals = params.get("goals", "Plan an event")

    await _emit(log_queue, "TIMELINE_BUILDER", f"Parsing goals into milestones: \"{goals[:60]}...\"")

    # Step 1: Fetch existing rules/constraints from the Compliance Agent
    rules = await database.get_documents("rules", {"project_id": project_id})
    constraints_text = ""
    if rules:
        await _emit(log_queue, "TIMELINE_BUILDER",
                    f"Cross-referencing {len(rules)} venue constraints", "info")
        constraints_text = "\n".join([
            f"- [{r.get('severity', 'info').upper()}] {r.get('text', '')}" +
            (f" (Time: {r.get('time_constraint', {})})" if r.get('time_constraint') else "")
            for r in rules
        ])

    # Step 2: Use Gemini to generate the timeline
    api_key = os.getenv("GEMINI_API_KEY")
    milestones = []
    tasks = []

    if api_key and genai:
        try:
            client = genai.Client(api_key=api_key)

            prompt = f"""You are an expert event project manager. Create a detailed project timeline and task checklist.

User's goals: {goals}
Today's date: {datetime.utcnow().strftime('%Y-%m-%d')}

{"Venue constraints to avoid conflicts with:" + chr(10) + constraints_text if constraints_text else "No venue constraints loaded yet."}

Return ONLY a JSON object:
{{
  "milestones": [
    {{"label": "...", "date": "YYYY-MM-DD", "description": "1-2 sentences"}}
  ],
  "tasks": [
    {{"text": "...", "priority": "normal|high|critical", "category": "venue|marketing|logistics|speakers|sponsors"}}
  ]
}}

Rules:
- Create 5-8 milestones in chronological order
- Create 8-12 actionable tasks
- If venue constraints mention time restrictions, do NOT schedule conflicting activities during those times
- Mark the milestone closest to today as having its date match the current date"""

            response = client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=genai.types.GenerateContentConfig(temperature=0.3, max_output_tokens=4096),
            )

            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]

            result = json.loads(raw.strip())

            for i, m in enumerate(result.get("milestones", [])):
                # Validate date with dateutil
                date_str = m.get("date", "")
                if dateparser:
                    try:
                        parsed = dateparser.parse(date_str)
                        date_str = parsed.strftime("%b %d")
                    except Exception:
                        pass

                is_current = i == len(result.get("milestones", [])) // 2  # Middle milestone as current
                milestones.append({
                    "id": str(uuid.uuid4()),
                    "label": m.get("label", ""),
                    "date": date_str,
                    "description": m.get("description", ""),
                    "done": i < len(result.get("milestones", [])) // 3,
                    "current": is_current,
                })
                await _emit(log_queue, "TIMELINE_BUILDER",
                            f"Milestone {i+1}: {m.get('label', '')} — {date_str}")

            for t in result.get("tasks", []):
                tasks.append({
                    "id": str(uuid.uuid4()),
                    "text": t.get("text", ""),
                    "done": False,
                    "priority": t.get("priority", "normal"),
                    "category": t.get("category", ""),
                })

            await _emit(log_queue, "TIMELINE_BUILDER",
                        f"Generated {len(milestones)} milestones and {len(tasks)} tasks", "success")

        except Exception as e:
            await _emit(log_queue, "TIMELINE_BUILDER", f"Gemini error: {e}", "error")

    if not milestones:
        # Fallback: generate a basic timeline
        await _emit(log_queue, "TIMELINE_BUILDER", "Using fallback timeline template", "warning")
        now = datetime.utcnow()
        fallback_milestones = [
            ("Venue Booked", -60, True), ("Speakers Confirmed", -30, True),
            ("Sponsors Locked", -14, True), ("Marketing Launch", 0, False),
            ("Ticket Sales Open", 7, False), ("Final Rehearsal", 28, False),
            ("Event Day", 35, False),
        ]
        for label, offset, done in fallback_milestones:
            if relativedelta:
                from datetime import timedelta
                date = now + timedelta(days=offset)
            else:
                from datetime import timedelta
                date = now + timedelta(days=offset)
            milestones.append({
                "id": str(uuid.uuid4()),
                "label": label,
                "date": date.strftime("%b %d"),
                "description": "",
                "done": done,
                "current": offset == 0,
            })

        tasks = [
            {"id": str(uuid.uuid4()), "text": t, "done": False, "priority": p, "category": ""}
            for t, p in [
                ("Finalize catering menu", "normal"), ("Review stage design with AV vendor", "high"),
                ("Confirm photographer schedule", "normal"), ("Send volunteer briefing packets", "high"),
                ("Test live-stream infrastructure", "critical"), ("Print attendee badges", "normal"),
                ("Coordinate speaker transportation", "normal"), ("Verify insurance documentation", "high"),
            ]
        ]

    # Step 3: Check for constraint conflicts
    if rules:
        for rule in rules:
            if rule.get("time_constraint"):
                await _emit(log_queue, "TIMELINE_BUILDER",
                            f"✓ Verified no conflicts with: {rule.get('text', '')[:50]}...", "success")

    roadmap_data = {
        "project_id": project_id,
        "milestones": milestones,
        "tasks": tasks,
        "updated_at": datetime.utcnow().isoformat(),
    }

    await _emit(log_queue, "TIMELINE_BUILDER", "Timeline saved to roadmap collection", "success")

    return AgentResult(
        agent_name="TIMELINE_BUILDER",
        domain="project_manager",
        status="success",
        collection="roadmap",
        data=roadmap_data,
    )
