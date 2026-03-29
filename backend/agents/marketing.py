"""
EventOS Marketing Agent — Image and Video sub-agents.
Uses Google Gemini API models (Nano Banana 2 and Veo 3.1).
"""

import os
import asyncio
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult

try:
    from google import genai
except ImportError:
    genai = None

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def _emit(log_queue: asyncio.Queue, agent: str, msg: str, level: str = "info"):
    await log_queue.put(AgentLog(
        timestamp=datetime.utcnow(),
        agent_name=agent,
        domain="marketing",
        message=msg,
        level=level,
    ))


async def image_subagent(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Creative Designer — Generates static images, flyers, and social media posts.
    Tool: Google Gemini API (Nano Banana 2).
    Constraint: Visual AI ONLY — no audio/ElevenLabs.
    """
    prompt = params.get("prompt", "A stunning event promotional banner")
    width = params.get("width", 1024)
    height = params.get("height", 1024)

    await _emit(log_queue, "IMAGE_SUBAGENT", f"Starting image generation — prompt: \"{prompt[:60]}...\"")
    await _emit(log_queue, "IMAGE_SUBAGENT", f"Resolution: {width}x{height} — Model: Nano Banana 2")

    url = f"https://placeholder.eventos.dev/image/{prompt[:20].replace(' ', '_')}.png"
    api_key = os.getenv("GEMINI_API_KEY")

    if api_key and genai:
        try:
            client = genai.Client(api_key=api_key)
            # Call Gemini API for image generation
            response = client.models.generate_images(
                model='nano-banana-2',
                prompt=prompt,
                config=genai.types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1" if width == height else "16:9"
                )
            )
            if response.generated_images and hasattr(response.generated_images[0], "url"):
                url = response.generated_images[0].url
            await _emit(log_queue, "IMAGE_SUBAGENT", f"Image generated successfully — URL: {url}", "success")
        except Exception as e:
            await _emit(log_queue, "IMAGE_SUBAGENT", f"Gemini API error (Nano Banana 2): {e}. Using placeholder.", "warning")
    else:
        await _emit(log_queue, "IMAGE_SUBAGENT", "GEMINI_API_KEY missing or genai not installed. Using placeholder.", "warning")

    # Generate a meaningful title from the prompt
    title = prompt[:50].title() if len(prompt) > 50 else prompt.title()

    return AgentResult(
        agent_name="IMAGE_SUBAGENT",
        domain="marketing",
        status="success",
        collection="assets",
        data={
            "type": "image",
            "title": title,
            "origin": "Creative Designer",
            "url": url,
            "thumbnail": url,
            "meta": f"{width}×{height} • PNG",
            "project_id": project_id,
            "created_at": datetime.utcnow().isoformat(),
        },
    )


async def video_subagent(params: dict, log_queue: asyncio.Queue, project_id: str = "default") -> AgentResult:
    """
    Cinematic Creator — Renders high-fidelity MP4 promotional videos.
    Tool: Google Gemini API (Veo 3.1).
    """
    prompt = params.get("prompt", "A cinematic event promotional reel")
    duration = params.get("duration_seconds", 10)

    await _emit(log_queue, "VIDEO_SUBAGENT", f"Starting video rendering — prompt: \"{prompt[:60]}...\"")
    await _emit(log_queue, "VIDEO_SUBAGENT", f"Duration: {duration}s — Model: Veo 3.1")
    await _emit(log_queue, "VIDEO_SUBAGENT", "Calling Gemini API — this may take several minutes...", "warning")

    url = f"https://placeholder.eventos.dev/video/{prompt[:20].replace(' ', '_')}.mp4"
    api_key = os.getenv("GEMINI_API_KEY")

    if api_key and genai:
        try:
            client = genai.Client(api_key=api_key)
            # Call Gemini API for video generation
            response = client.models.generate_videos(
                model='veo-3.1',
                prompt=prompt,
                config={
                    "duration_seconds": duration
                }
            )
            if hasattr(response, "video_url"):
                url = response.video_url
            elif hasattr(response, "generated_videos") and getattr(response.generated_videos[0], "url", None):
                url = response.generated_videos[0].url
            await _emit(log_queue, "VIDEO_SUBAGENT", f"Video rendered successfully — URL: {url}", "success")
        except Exception as e:
            await _emit(log_queue, "VIDEO_SUBAGENT", f"Gemini API error (Veo 3.1): {e}. Using placeholder.", "warning")
    else:
        await _emit(log_queue, "VIDEO_SUBAGENT", "GEMINI_API_KEY missing or genai not installed. Using placeholder.", "warning")

    title = prompt[:50].title() if len(prompt) > 50 else prompt.title()

    return AgentResult(
        agent_name="VIDEO_SUBAGENT",
        domain="marketing",
        status="success",
        collection="assets",
        data={
            "type": "video",
            "title": title,
            "origin": "Cinematic Creator",
            "url": url,
            "thumbnail": "",
            "meta": f"MP4 • {duration}s",
            "project_id": project_id,
            "created_at": datetime.utcnow().isoformat(),
        },
    )
