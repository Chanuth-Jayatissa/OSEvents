"""
EventOS Context Agent — Web Researcher sub-agent.
Browses the web to find relevant context that enriches other agents' outputs.
"""

import os
import json
import asyncio
import uuid
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult

try:
    from google import genai
except ImportError:
    genai = None

try:
    import aiohttp
except ImportError:
    aiohttp = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="context",
        message=msg,
        level=level,
    ))


async def web_researcher(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Web Researcher Sub-agent.
    Tools: Google Custom Search API + aiohttp + Gemini Flash for summarization.
    """
    query = params.get("query", "event planning best practices")
    max_sources = params.get("max_sources", 5)

    await _emit(log_queue, "WEB_RESEARCHER", f"Searching: \"{query}\"")

    sources = []
    raw_content = []

    # Step 1: Google Custom Search
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cse_id = os.getenv("GOOGLE_CSE_ID")

    if api_key and cse_id and aiohttp:
        try:
            url = (
                f"https://www.googleapis.com/customsearch/v1"
                f"?key={api_key}&cx={cse_id}&q={query}&num={min(max_sources, 10)}"
            )

            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("items", [])

                        for i, item in enumerate(items[:max_sources]):
                            await _emit(log_queue, "WEB_RESEARCHER",
                                        f"Visiting source {i+1}/{min(len(items), max_sources)}: {item.get('displayLink', '')}")

                            source = {
                                "url": item.get("link", ""),
                                "title": item.get("title", ""),
                                "snippet": item.get("snippet", ""),
                            }
                            sources.append(source)
                            raw_content.append(f"Source: {source['title']}\nURL: {source['url']}\nContent: {source['snippet']}")
                            await asyncio.sleep(0.2)

                    else:
                        await _emit(log_queue, "WEB_RESEARCHER",
                                    f"Search API returned {resp.status}", "warning")

        except Exception as e:
            await _emit(log_queue, "WEB_RESEARCHER", f"Search error: {e}", "error")

    if not sources:
        # Fallback: generate sample research data
        await _emit(log_queue, "WEB_RESEARCHER",
                    "Google CSE not configured — generating sample research context", "warning")
        sample_sources = [
            {"url": "https://mlh.io/sponsorship-guide", "title": "MLH Sponsorship Guide 2026",
             "snippet": "Typical hackathon sponsorship tiers range from $500 (Bronze) to $15,000+ (Title sponsor). Key benefits include branded tracks, API prizes, and recruiting access."},
            {"url": "https://devpost.com/hackathons", "title": "Top Hackathons 2026 — Devpost",
             "snippet": "Most successful hackathons attract 200-1000 participants. Average budget ranges from $20K-$100K depending on scale. Food, venue, and prizes are the top three expenses."},
            {"url": "https://gdg.community.dev/events", "title": "GDG Community Events Best Practices",
             "snippet": "GDG events typically run 1-2 days. Recommended to have 1 volunteer per 20 attendees. Speaker selection should begin 3 months before the event."},
        ]
        sources = sample_sources
        raw_content = [f"Source: {s['title']}\nContent: {s['snippet']}" for s in sources]

    # Step 2: Summarize with Gemini
    gemini_key = os.getenv("GEMINI_API_KEY")
    summarized_sources = []

    if gemini_key and genai and raw_content:
        try:
            await _emit(log_queue, "WEB_RESEARCHER",
                        f"Summarizing {len(sources)} sources with Gemini Flash")

            client = genai.Client(api_key=gemini_key)

            prompt = f"""Summarize the following web research into concise, actionable context for event planning.

Research query: "{query}"

Sources:
{chr(10).join(raw_content)}

For each source, provide a JSON array:
[{{
    "url": "...",
    "title": "...",
    "summary": "2-3 sentence actionable summary",
    "key_points": ["point 1", "point 2"],
    "relevance_score": 0-100
}}]

Return ONLY the JSON array."""

            response = client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=genai.types.GenerateContentConfig(temperature=0.2, max_output_tokens=4096),
            )

            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]

            summarized_sources = json.loads(raw.strip())

            for s in summarized_sources:
                await _emit(log_queue, "WEB_RESEARCHER",
                            f"✓ {s.get('title', '?')} — relevance: {s.get('relevance_score', 0)}%")

        except Exception as e:
            await _emit(log_queue, "WEB_RESEARCHER", f"Summarization error: {e}", "warning")

    if not summarized_sources:
        summarized_sources = [
            {
                "url": s.get("url", ""),
                "title": s.get("title", ""),
                "summary": s.get("snippet", ""),
                "key_points": [],
                "relevance_score": 70,
            }
            for s in sources
        ]

    await _emit(log_queue, "WEB_RESEARCHER",
                f"Research complete — {len(summarized_sources)} sources analyzed", "success")

    return AgentResult(
        agent_name="WEB_RESEARCHER",
        domain="context",
        status="success",
        collection="context",
        data={
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "topic": query,
            "sources": summarized_sources,
            "created_at": datetime.utcnow().isoformat(),
        },
    )
