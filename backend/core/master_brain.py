"""
EventOS Master Brain — The Core Routing Agent.
Powered by Gemini 3.1 Pro. Analyzes user prompts, extracts intents,
and returns structured dispatch instructions. Does NOT execute any tasks.
"""

import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = None

SYSTEM_PROMPT = """You are the EventOS Master Brain — the core routing agent for a multi-agent event management platform.

Your ONLY job is to analyze the user's natural language prompt and extract actionable intents. You do NOT execute tasks.

Available intents (you may select multiple for parallel execution):
- "generate_image" — User wants promotional images, flyers, social media graphics, banners
- "generate_video" — User wants promotional videos, reels, highlight clips
- "find_sponsors" — User wants to find/discover potential sponsors, scrape company data
- "match_tiers" — User wants to assign sponsors to tiers, evaluate sponsor fit, create tier structure
- "build_timeline" — User wants to create/update a project timeline, milestones, or task checklist
- "send_discord" — User wants to create a Discord server, send messages, or post updates to Discord
- "send_email" — User wants to draft/send emails to specific people or groups
- "extract_rules" — User has uploaded a venue contract/document and wants constraints extracted
- "research_context" — User wants research on a topic, benchmarking data, or general web-based context
- "plan_budget" — User wants to create/plan a budget for the event
- "track_expense" — User wants to log an expense against the budget
- "respond_user" — User is asking a conversational question, asking for advice, checking status, or wants general chat.

Respond with ONLY a valid JSON object matching this schema exactly (no markdown formatting required as output is forced to pure JSON):
{
  "intents": ["intent1", "intent2"],
  "params": {
    "intent1": {"key": "value"},
    "intent2": {"key": "value"}
  }
}

Rules:
1. You MUST select at least one intent.
2. If the user is just chatting or asking a knowledge question, select ONLY "respond_user" and provide the response in params.
3. If the prompt maps to multiple intents, include ALL of them — they will execute in parallel.
4. Extract relevant parameters from the prompt for each intent (e.g., count, query, topic, recipient).
5. For "generate_image" params include: prompt (description of what to generate), width, height.
6. For "generate_video" params include: prompt, duration_seconds.
7. For "find_sponsors" params include: query, count, industry (if mentioned).
8. For "match_tiers" params include: event_type, event_size, tiers.
9. For "build_timeline" params include: goals (the user's description).
10. For "send_discord" params include: action (create_server/send_message/dm_user), message.
11. For "send_email" params include: recipient_name, company, purpose.
12. For "research_context" params include: query, max_sources.
13. For "plan_budget" params include: event_type, attendee_count, duration_days.
14. For "track_expense" params include: category, amount, description.
15. For "respond_user" params include: response (The natural language answer to the user's question, pretending you are the Master Brain).
"""


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in .env")
        _client = genai.Client(api_key=api_key)
    return _client


async def route(prompt: str, project_id: str = "default") -> dict:
    """
    Analyze a user prompt and extract intents + params.
    Returns: {"intents": [...], "params": {...}}
    """
    try:
        client = _get_client()

        response = client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=f"Project ID: {project_id}\nUser prompt: {prompt}",
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        result = json.loads(raw_text)

        # Validate structure
        if "intents" not in result or not isinstance(result["intents"], list):
            result = {"intents": ["respond_user"], "params": {"respond_user": {"response": "I'm not sure what you mean. Could you clarify?"}}}

        if "params" not in result:
            result["params"] = {}

        return result

    except json.JSONDecodeError as e:
        print(f"⚠️ Master Brain JSON parse error: {e}")
        return {
            "intents": ["respond_user"],
            "params": {"respond_user": {"response": "I encountered a processing error while routing."}}
        }
    except Exception as e:
        print(f"❌ Master Brain error: {e}")
        return {
            "intents": ["respond_user"],
            "params": {"respond_user": {"response": "I encountered a system error."}}
        }
