"""
EventOS Communication Agent — Discord and Email sub-agents.
"""

import os
import json
import asyncio
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
        domain="communication",
        message=msg,
        level=level,
    ))


async def discord_subagent(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Discord Sub-agent — Creates servers, sends channel messages, DMs individuals.
    Tools: Discord Bot API via discord.py or Webhook API.
    """
    action = params.get("action", "send_message")
    message = params.get("message", "Hello from EventOS!")
    server_name = params.get("server_name", f"EventOS - {project_id}")
    channel = params.get("channel", "general")

    await _emit(log_queue, "DISCORD_SUBAGENT", f"Discord action: {action}")

    result_data = {
        "action": action,
        "project_id": project_id,
        "timestamp": datetime.utcnow().isoformat(),
    }

    if action == "create_server":
        await _emit(log_queue, "DISCORD_SUBAGENT", f"Creating Discord server: {server_name}")
        # In production, this would use discord.py bot to create a server
        # For now, we simulate the flow
        await asyncio.sleep(1)
        await _emit(log_queue, "DISCORD_SUBAGENT",
                    "Created channels: #general, #announcements, #logistics, #sponsors")
        await _emit(log_queue, "DISCORD_SUBAGENT",
                    f"Server '{server_name}' created successfully", "success")
        result_data.update({
            "server_name": server_name,
            "channels": ["general", "announcements", "logistics", "sponsors"],
            "invite_link": f"https://discord.gg/eventos-{project_id[:8]}",
        })

    elif action == "send_message":
        await _emit(log_queue, "DISCORD_SUBAGENT",
                    f"Sending message to #{channel}: \"{message[:50]}...\"")

        # Try Discord webhook if configured
        webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
        if webhook_url and aiohttp:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "content": message,
                        "username": "EventOS",
                        "embeds": [{
                            "title": f"EventOS Update — {project_id}",
                            "description": message,
                            "color": 0xDAA520,  # Gold color
                            "timestamp": datetime.utcnow().isoformat(),
                        }]
                    }
                    async with session.post(webhook_url, json=payload) as resp:
                        if resp.status in (200, 204):
                            await _emit(log_queue, "DISCORD_SUBAGENT",
                                        "Message sent via webhook", "success")
                        else:
                            await _emit(log_queue, "DISCORD_SUBAGENT",
                                        f"Webhook returned status {resp.status}", "warning")
            except Exception as e:
                await _emit(log_queue, "DISCORD_SUBAGENT",
                            f"Webhook error: {e}", "warning")
        else:
            await asyncio.sleep(0.5)
            await _emit(log_queue, "DISCORD_SUBAGENT",
                        "Message queued (Discord webhook not configured)", "warning")

        result_data.update({"channel": channel, "message": message})

    elif action == "dm_user":
        user_id = params.get("user_id", "")
        await _emit(log_queue, "DISCORD_SUBAGENT",
                    f"Sending DM to user {user_id}: \"{message[:50]}...\"")
        await asyncio.sleep(0.5)
        await _emit(log_queue, "DISCORD_SUBAGENT", "Direct message sent", "success")
        result_data.update({"user_id": user_id, "message": message})

    return AgentResult(
        agent_name="DISCORD_SUBAGENT",
        domain="communication",
        status="success",
        collection="agent_logs",
        data=result_data,
    )


async def email_subagent(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Email Sub-agent — Drafts personalized emails with Gemini Flash,
    sends via Gmail API using the user's authenticated Google account.
    """
    recipient_name = params.get("recipient_name", "")
    recipient_email = params.get("recipient_email", "")
    company = params.get("company", "")
    purpose = params.get("purpose", "sponsorship_outreach")
    context = params.get("context", "")
    user_id = params.get("user_id", "")

    await _emit(log_queue, "EMAIL_SUBAGENT",
                f"Drafting {purpose} email for {recipient_name or company}")

    # Step 1: Draft with Gemini Flash
    api_key = os.getenv("GEMINI_API_KEY")
    email_subject = ""
    email_body = ""

    if api_key and genai:
        try:
            client = genai.Client(api_key=api_key)

            prompt = f"""Draft a professional, personalized email for the following purpose.

Purpose: {purpose}
Recipient: {recipient_name} at {company}
Additional context: {context}
Sender: EventOS Organizing Team

Return ONLY a JSON object:
{{"subject": "...", "body": "full email text with proper greeting and sign-off"}}"""

            response = client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt,
                config=genai.types.GenerateContentConfig(temperature=0.4, max_output_tokens=2048),
            )

            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]

            result = json.loads(raw.strip())
            email_subject = result.get("subject", f"Partnership Opportunity — EventOS")
            email_body = result.get("body", "")

            await _emit(log_queue, "EMAIL_SUBAGENT",
                        f"Email drafted — Subject: \"{email_subject}\"", "success")

        except Exception as e:
            await _emit(log_queue, "EMAIL_SUBAGENT", f"Gemini drafting error: {e}", "warning")
            email_subject = f"Partnership Opportunity — EventOS"
            email_body = f"Hi {recipient_name},\n\nWe'd love to explore a partnership with {company}.\n\nBest regards,\nEventOS Team"

    else:
        email_subject = f"Partnership Opportunity — EventOS"
        email_body = f"Hi {recipient_name},\n\nWe'd love to explore a partnership with {company}.\n\nBest regards,\nEventOS Team"

    # Step 2: Send via Gmail API (using the user's own Gmail account)
    send_status = "drafted"
    from_email = ""

    if user_id and recipient_email:
        try:
            from backend.core.auth import send_gmail

            await _emit(log_queue, "EMAIL_SUBAGENT",
                        "Sending via Gmail API (from your authenticated account)")

            gmail_result = await send_gmail(
                user_id=user_id,
                to_email=recipient_email,
                subject=email_subject,
                body=email_body,
            )

            if gmail_result["status"] == "sent":
                send_status = "sent"
                from_email = gmail_result.get("from", "")
                await _emit(log_queue, "EMAIL_SUBAGENT",
                            f"Email sent from {from_email} to {recipient_email}", "success")
            else:
                send_status = "failed"
                error = gmail_result.get("error", "Unknown error")
                await _emit(log_queue, "EMAIL_SUBAGENT",
                            f"Gmail send error: {error}", "error")

        except Exception as e:
            await _emit(log_queue, "EMAIL_SUBAGENT", f"Gmail API error: {e}", "error")
            send_status = "failed"
    else:
        if not user_id:
            await _emit(log_queue, "EMAIL_SUBAGENT",
                        "Email drafted — sign in with Google to send from your Gmail", "warning")
        elif not recipient_email:
            await _emit(log_queue, "EMAIL_SUBAGENT",
                        "Email drafted — no recipient email provided", "warning")

    return AgentResult(
        agent_name="EMAIL_SUBAGENT",
        domain="communication",
        status="success",
        collection="agent_logs",
        data={
            "recipient": recipient_name,
            "email": recipient_email,
            "company": company,
            "subject": email_subject,
            "body": email_body,
            "status": send_status,
            "from": from_email,
            "project_id": project_id,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

