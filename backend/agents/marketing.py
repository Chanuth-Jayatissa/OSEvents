"""
EventOS Marketing Agent — Image and Video sub-agents.
Uses Vultr GPU instance for Stable Diffusion (images) and CogVideoX (videos).
"""

import asyncio
from datetime import datetime
from backend.core.contracts import AgentLog, AgentResult
from backend.gpu import inference_gateway


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
    Tool: Stable Diffusion on Vultr A40 GPU.
    Constraint: Visual AI ONLY — no audio/ElevenLabs.
    """
    prompt = params.get("prompt", "A stunning event promotional banner")
    width = params.get("width", 1024)
    height = params.get("height", 1024)

    await _emit(log_queue, "IMAGE_SUBAGENT", f"Starting image generation — prompt: \"{prompt[:60]}...\"")
    await _emit(log_queue, "IMAGE_SUBAGENT", f"Resolution: {width}x{height} — Model: Stable Diffusion (Vultr A40)")

    # Call GPU inference gateway
    url = await inference_gateway.generate_image(prompt, width, height)

    await _emit(log_queue, "IMAGE_SUBAGENT", f"Image generated successfully — URL: {url}", "success")

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
    Tool: CogVideoX on Vultr A40 GPU.
    """
    prompt = params.get("prompt", "A cinematic event promotional reel")
    duration = params.get("duration_seconds", 10)

    await _emit(log_queue, "VIDEO_SUBAGENT", f"Starting video rendering — prompt: \"{prompt[:60]}...\"")
    await _emit(log_queue, "VIDEO_SUBAGENT", f"Duration: {duration}s — Model: CogVideoX (Vultr A40)")
    await _emit(log_queue, "VIDEO_SUBAGENT", "Allocating GPU resources — this may take several minutes...", "warning")

    # Call GPU inference gateway (long-running)
    url = await inference_gateway.generate_video(prompt, duration)

    await _emit(log_queue, "VIDEO_SUBAGENT", f"Video rendered successfully — URL: {url}", "success")

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
