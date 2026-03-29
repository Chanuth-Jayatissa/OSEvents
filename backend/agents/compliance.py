"""
EventOS Compliance Agent — Rule Extractor sub-agent.
Ingests PDF contracts and extracts hard constraints.
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
    import PyPDF2
except ImportError:
    PyPDF2 = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="compliance",
        message=msg,
        level=level,
    ))


async def rule_extractor(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Rule Extractor Sub-agent.
    Tools: PyPDF2 for text extraction + Gemini 1.5 Flash for entity extraction.
    Output is cross-referenced by the Project Manager agent.
    """
    file_path = params.get("file_path", "")

    await _emit(log_queue, "RULE_EXTRACTOR", f"Processing document: {os.path.basename(file_path) if file_path else 'no file'}")

    # Step 1: Extract text from PDF
    pdf_text = ""

    if file_path and os.path.exists(file_path) and PyPDF2:
        try:
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                num_pages = len(reader.pages)
                await _emit(log_queue, "RULE_EXTRACTOR", f"Extracting text from {num_pages}-page PDF")

                for i, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text:
                        pdf_text += text + "\n"
                    await _emit(log_queue, "RULE_EXTRACTOR",
                                f"Processed page {i+1}/{num_pages}")

                if not pdf_text.strip():
                    await _emit(log_queue, "RULE_EXTRACTOR",
                                "No text extracted — PDF may be scanned/image-based", "warning")
        except Exception as e:
            await _emit(log_queue, "RULE_EXTRACTOR", f"PDF extraction error: {e}", "error")
    elif not file_path:
        # Use sample text for development
        await _emit(log_queue, "RULE_EXTRACTOR",
                    "No file provided — using sample contract data for demo", "warning")
        pdf_text = """VENUE CONTRACT — Convention Center Hall A
        
        Maximum occupancy: 2,000 persons at any given time.
        Sound levels must not exceed 85dB after 22:00 local time.
        All fire exits must remain unobstructed at all times.
        Load-in and load-out permitted between 06:00 and 22:00 only.
        Catering license valid through June 30, 2026.
        Stage load bearing capacity: 500kg maximum.
        Open flames and pyrotechnics require 30-day advance notice and separate permit.
        Parking lot closes at midnight — all vehicles must be cleared.
        Insurance certificate required minimum 14 days before event date.
        """

    # Step 2: Use Gemini for entity extraction
    rules = []
    api_key = os.getenv("GEMINI_API_KEY")

    if pdf_text and api_key and genai:
        try:
            client = genai.Client(api_key=api_key)

            prompt = f"""Extract ALL hard constraints, rules, and requirements from this venue contract/document.

Document text:
{pdf_text[:8000]}

Return ONLY a JSON array:
[{{
    "text": "human-readable rule description",
    "severity": "info|warning|critical",
    "category": "noise|capacity|timing|safety|catering|insurance|parking|other",
    "time_constraint": null or {{"start": "HH:MM", "end": "HH:MM"}}
}}]

Severity guide:
- critical: Safety rules, fire regulations, legal requirements
- warning: Time-sensitive constraints, capacity limits
- info: General operational rules"""

            response = client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=genai.types.GenerateContentConfig(temperature=0.1, max_output_tokens=4096),
            )

            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]

            extracted = json.loads(raw.strip())

            for rule_data in extracted:
                rules.append({
                    "id": str(uuid.uuid4()),
                    "text": rule_data.get("text", ""),
                    "severity": rule_data.get("severity", "info"),
                    "category": rule_data.get("category", "other"),
                    "time_constraint": rule_data.get("time_constraint"),
                    "project_id": project_id,
                    "source_file": os.path.basename(file_path) if file_path else "sample_contract",
                })

            critical = sum(1 for r in rules if r["severity"] == "critical")
            warnings = sum(1 for r in rules if r["severity"] == "warning")
            await _emit(log_queue, "RULE_EXTRACTOR",
                        f"Extracted {len(rules)} constraints — {critical} critical, {warnings} warnings",
                        "success")

        except Exception as e:
            await _emit(log_queue, "RULE_EXTRACTOR", f"Gemini extraction error: {e}", "error")

    if not rules:
        # Fallback
        await _emit(log_queue, "RULE_EXTRACTOR", "Using fallback rule set", "warning")
        rules = [
            {"id": str(uuid.uuid4()), "text": "Max occupancy: 2,000 persons", "severity": "info",
             "category": "capacity", "time_constraint": None, "project_id": project_id, "source_file": "fallback"},
            {"id": str(uuid.uuid4()), "text": "Sound curfew at 22:00 local", "severity": "warning",
             "category": "noise", "time_constraint": {"start": "22:00", "end": "06:00"}, "project_id": project_id, "source_file": "fallback"},
            {"id": str(uuid.uuid4()), "text": "Fire exits must remain unobstructed", "severity": "critical",
             "category": "safety", "time_constraint": None, "project_id": project_id, "source_file": "fallback"},
        ]

    return AgentResult(
        agent_name="RULE_EXTRACTOR",
        domain="compliance",
        status="success",
        collection="rules",
        data={"rules": rules, "project_id": project_id,
              "source_file": os.path.basename(file_path) if file_path else "sample"},
    )
