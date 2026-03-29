"""
EventOS GPU Inference Gateway — Client for the Vultr A40 GPU instance
running Stable Diffusion and CogVideoX behind a FastAPI endpoint.
"""

import os
import asyncio
import aiohttp
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

VULTR_GPU_ENDPOINT = os.getenv("VULTR_GPU_ENDPOINT", "http://localhost:9000")


async def _request_with_retry(
    method: str,
    url: str,
    json_body: dict,
    max_retries: int = 3,
    timeout_seconds: int = 60,
) -> dict:
    """Make an HTTP request with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            timeout = aiohttp.ClientTimeout(total=timeout_seconds)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(method, url, json=json_body) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        error_text = await resp.text()
                        raise Exception(f"GPU endpoint returned {resp.status}: {error_text}")
        except (aiohttp.ClientError, asyncio.TimeoutError, Exception) as e:
            if attempt == max_retries - 1:
                raise Exception(f"GPU inference failed after {max_retries} attempts: {e}")
            wait_time = 2 ** attempt
            print(f"⚠️ GPU request attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
            await asyncio.sleep(wait_time)


async def generate_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    negative_prompt: str = "",
) -> str:
    """
    Send an image generation request to the Vultr GPU instance.
    Returns the URL of the generated image.
    """
    url = f"{VULTR_GPU_ENDPOINT}/generate/image"
    payload = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "negative_prompt": negative_prompt,
        "num_inference_steps": 30,
    }

    try:
        result = await _request_with_retry("POST", url, payload, timeout_seconds=120)
        return result.get("url", result.get("image_url", ""))
    except Exception:
        # Return a placeholder if GPU is unavailable (for development)
        return f"https://placeholder.eventos.dev/image/{prompt[:20].replace(' ', '_')}.png"


async def generate_video(
    prompt: str,
    duration_seconds: int = 10,
    resolution: str = "720p",
) -> str:
    """
    Send a video generation request to the Vultr GPU instance.
    Video rendering can take several minutes — timeout is set to 10min.
    Returns the URL of the generated video.
    """
    url = f"{VULTR_GPU_ENDPOINT}/generate/video"
    payload = {
        "prompt": prompt,
        "duration_seconds": duration_seconds,
        "resolution": resolution,
    }

    try:
        result = await _request_with_retry("POST", url, payload, timeout_seconds=600)
        return result.get("url", result.get("video_url", ""))
    except Exception:
        # Return a placeholder if GPU is unavailable (for development)
        return f"https://placeholder.eventos.dev/video/{prompt[:20].replace(' ', '_')}.mp4"


async def check_gpu_health() -> dict:
    """Check if the GPU inference server is online."""
    try:
        result = await _request_with_retry(
            "GET", f"{VULTR_GPU_ENDPOINT}/health", {}, max_retries=1, timeout_seconds=5
        )
        return {"status": "online", "details": result}
    except Exception as e:
        return {"status": "offline", "error": str(e)}
