"""
EventOS Sponsor Agent — Web Scraper and Tier Matcher sub-agents.
Finds potential sponsors and assigns them to optimal tiers.
"""

import os
import json
import asyncio
import uuid
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult
from backend.db import database

try:
    import aiohttp
except ImportError:
    aiohttp = None

try:
    from google import genai
except ImportError:
    genai = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="sponsor",
        message=msg,
        level=level,
    ))


async def web_scraper(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Web Scraper Sub-agent — Finds companies matching event criteria.
    Tools: Google Custom Search API + aiohttp for page fetching.
    """
    query = params.get("query", "tech companies sponsoring hackathons")
    count = params.get("count", 10)
    industry = params.get("industry", "")

    await _emit(log_queue, "WEB_SCRAPER", f"Searching for: \"{query}\" — target: {count} companies")

    leads = []

    # Use Google Custom Search API
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cse_id = os.getenv("GOOGLE_CSE_ID")

    if api_key and cse_id and aiohttp:
        search_query = f"{query} {industry}".strip()
        url = (
            f"https://www.googleapis.com/customsearch/v1"
            f"?key={api_key}&cx={cse_id}&q={search_query}&num={min(count, 10)}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("items", [])

                        for i, item in enumerate(items):
                            await _emit(log_queue, "WEB_SCRAPER",
                                        f"Scraping result {i+1}/{len(items)} — {item.get('title', 'Unknown')}")

                            lead = {
                                "id": str(uuid.uuid4()),
                                "company": item.get("title", "Unknown Company").split(" - ")[0].split(" | ")[0],
                                "industry": industry or "Technology",
                                "contact": "",
                                "email": "",
                                "website": item.get("link", ""),
                                "location": "",
                                "score": 0,
                                "recommended_tier": "",
                                "estimated_value": 0,
                                "status": "loading",
                                "reasoning": "",
                                "project_id": project_id,
                                "snippet": item.get("snippet", ""),
                                "created_at": datetime.utcnow().isoformat(),
                            }
                            leads.append(lead)
                            await asyncio.sleep(0.2)  # Rate limiting
                    else:
                        await _emit(log_queue, "WEB_SCRAPER",
                                    f"Google CSE returned status {resp.status}", "warning")
        except Exception as e:
            await _emit(log_queue, "WEB_SCRAPER", f"Search API error: {e}", "error")

    if not leads:
        # Fallback: generate sample leads for development
        await _emit(log_queue, "WEB_SCRAPER",
                    "Google CSE not configured — generating sample leads for development", "warning")
        sample_companies = [
            ("Vercel", "DevTools", "Sarah Chen"), ("Stripe", "FinTech", "Marcus Webb"),
            ("Figma", "Design", "Alex Rivera"), ("Notion", "Productivity", "Ava Patel"),
            ("Cloudflare", "Infrastructure", "James Liu"), ("Linear", "DevTools", "Nina Vasquez"),
            ("Supabase", "Database", "Tom Richter"), ("Datadog", "Observability", "Emily Zhang"),
            ("Netlify", "DevTools", "Chris Morgan"), ("PlanetScale", "Database", "Sam Johnson"),
        ]
        for i, (company, ind, contact) in enumerate(sample_companies[:count]):
            await _emit(log_queue, "WEB_SCRAPER", f"Found lead {i+1}/{count} — {company}")
            leads.append({
                "id": str(uuid.uuid4()),
                "company": company,
                "industry": ind,
                "contact": contact,
                "email": f"{contact.split()[0].lower()}@{company.lower()}.com",
                "website": f"https://{company.lower()}.com",
                "location": "San Francisco, CA",
                "score": 0,
                "recommended_tier": "",
                "estimated_value": 0,
                "status": "ready",
                "reasoning": "",
                "project_id": project_id,
                "created_at": datetime.utcnow().isoformat(),
            })
            await asyncio.sleep(0.1)

    await _emit(log_queue, "WEB_SCRAPER", f"Scraping complete — found {len(leads)} potential sponsors", "success")

    return AgentResult(
        agent_name="WEB_SCRAPER",
        domain="sponsor",
        status="success",
        collection="leads",
        data={"leads": leads, "project_id": project_id},
    )


async def tier_matcher(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Tier Matcher Sub-agent — Assigns sponsors to optimal tiers to maximize revenue.
    Tools: Gemini 1.5 Flash + openpyxl for Excel export.
    """
    event_type = params.get("event_type", "hackathon")
    event_size = params.get("event_size", 500)
    tiers = params.get("tiers", ["Platinum", "Gold", "Silver", "Bronze"])

    await _emit(log_queue, "TIER_MATCHER", f"Loading leads for tier matching — event: {event_type}, size: {event_size}")

    # Get existing leads from DB
    leads_data = params.get("leads", None)
    if not leads_data:
        raw_leads = await database.get_documents("leads", {"project_id": project_id})
        leads_data = raw_leads if raw_leads else []

    if not leads_data:
        await _emit(log_queue, "TIER_MATCHER", "No leads found — run the Web Scraper first", "warning")
        return AgentResult(
            agent_name="TIER_MATCHER",
            domain="sponsor",
            status="error",
            collection="leads",
            data={"error": "No leads to match"},
        )

    await _emit(log_queue, "TIER_MATCHER", f"Evaluating {len(leads_data)} leads against {len(tiers)} tiers")

    # Use Gemini Flash for tier assignment
    api_key = os.getenv("GEMINI_API_KEY")
    matched_leads = []

    if api_key and genai:
        try:
            client = genai.Client(api_key=api_key)

            prompt = f"""You are an expert event sponsorship strategist. Given these potential sponsors and an event, 
assign each sponsor to the optimal tier to MAXIMIZE total sponsorship revenue while ensuring good benefit alignment.

Event: {event_type} with {event_size} attendees
Tiers: {json.dumps(tiers)} (from highest to lowest value)

Sponsors to evaluate:
{json.dumps([{"company": l.get("company", ""), "industry": l.get("industry", ""), "snippet": l.get("snippet", "")} for l in leads_data[:20]], indent=2)}

For each sponsor, return a JSON array:
[{{"company": "...", "match_score": 0-100, "recommended_tier": "...", "estimated_value": dollar_amount, "reasoning": "1-2 sentences"}}]

Return ONLY the JSON array, no markdown."""

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

            evaluations = json.loads(raw.strip())

            for eval_data in evaluations:
                company = eval_data.get("company", "")
                # Find the original lead
                original = next((l for l in leads_data if l.get("company") == company), None)
                if original:
                    original.update({
                        "score": eval_data.get("match_score", 0),
                        "recommended_tier": eval_data.get("recommended_tier", ""),
                        "estimated_value": eval_data.get("estimated_value", 0),
                        "reasoning": eval_data.get("reasoning", ""),
                        "status": "ready",
                    })
                    matched_leads.append(original)
                    await _emit(log_queue, "TIER_MATCHER",
                                f"{company} → {eval_data.get('recommended_tier', '?')} "
                                f"(Score: {eval_data.get('match_score', 0)}%)")

        except Exception as e:
            await _emit(log_queue, "TIER_MATCHER", f"Gemini evaluation error: {e}", "error")

    if not matched_leads:
        # Fallback: simple scoring
        await _emit(log_queue, "TIER_MATCHER", "Using fallback scoring algorithm", "warning")
        import random
        for lead in leads_data:
            score = random.randint(60, 98)
            tier_idx = 0 if score >= 90 else 1 if score >= 80 else 2 if score >= 70 else 3
            lead.update({
                "score": score,
                "recommended_tier": tiers[min(tier_idx, len(tiers) - 1)],
                "estimated_value": [10000, 5000, 2500, 1000][min(tier_idx, 3)],
                "status": "ready",
            })
            matched_leads.append(lead)
            await _emit(log_queue, "TIER_MATCHER",
                        f"{lead.get('company', '?')} → {lead.get('recommended_tier', '?')} (Score: {score}%)")

    # Generate Excel export
    excel_path = ""
    if openpyxl:
        try:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Sponsor Tiers"
            headers = ["Company", "Industry", "Contact", "Match Score", "Tier", "Est. Value ($)", "Reasoning"]
            ws.append(headers)

            for lead in matched_leads:
                ws.append([
                    lead.get("company", ""),
                    lead.get("industry", ""),
                    lead.get("contact", ""),
                    lead.get("score", 0),
                    lead.get("recommended_tier", ""),
                    lead.get("estimated_value", 0),
                    lead.get("reasoning", ""),
                ])

            excel_path = os.path.join(os.path.dirname(__file__), "..", "exports", f"sponsors_{project_id}.xlsx")
            os.makedirs(os.path.dirname(excel_path), exist_ok=True)
            wb.save(excel_path)
            await _emit(log_queue, "TIER_MATCHER", f"Excel exported: {excel_path}", "success")
        except Exception as e:
            await _emit(log_queue, "TIER_MATCHER", f"Excel export failed: {e}", "warning")

    total_value = sum(l.get("estimated_value", 0) for l in matched_leads)
    await _emit(log_queue, "TIER_MATCHER",
                f"Tier matching complete — {len(matched_leads)} sponsors, total projected value: ${total_value:,.0f}",
                "success")

    return AgentResult(
        agent_name="TIER_MATCHER",
        domain="sponsor",
        status="success",
        collection="leads",
        data={"leads": matched_leads, "project_id": project_id, "excel_path": excel_path},
    )
