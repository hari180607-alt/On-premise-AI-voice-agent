"""API routes package."""
import asyncio
import httpx
from fastapi import APIRouter
from app.database import db_manager
from app.config import settings

router = APIRouter(prefix="/health", tags=["System Health"])


@router.get("", summary="System Health Check")
async def health_check():
    """Check application system health, database, and Ollama connectivity status."""
    db_connected = False
    db_status = "Disconnected"

    if db_manager.client is not None:
        try:
            # Ping database to verify active connection
            await db_manager.client.admin.command("ping")
            db_connected = True
            db_status = "Connected"
        except Exception as e:
            db_status = f"Connection error: {str(e)}"

    ollama_connected = False
    ollama_status = "Disconnected"
    model_available = False

    try:
        async def _check_ollama():
            async with httpx.AsyncClient(timeout=0.5) as client:
                res = await client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
                if res.status_code == 200:
                    return True, "Connected", any(settings.OLLAMA_MODEL in m.get("name", "") for m in res.json().get("models", []))
            return False, "Disconnected", False

        ollama_connected, ollama_status, model_available = await asyncio.wait_for(_check_ollama(), timeout=0.5)
    except Exception as e:
        ollama_connected = False
        ollama_status = f"Connection error: {str(e)}"
        model_available = False

    # Check Piper TTS availability
    from app.services.voice_service import _check_piper_available
    piper_available = _check_piper_available()

    return {
        "status": "healthy",
        "backend": {
            "connected": True
        },
        "database": {
            "connected": db_connected,
            "status": db_status
        },
        "ollama": {
            "connected": ollama_connected,
            "status": ollama_status,
            "model": settings.OLLAMA_MODEL,
            "model_available": model_available
        },
        "voice": {
            "whisper_stt": True,
            "tts": True,
            "tts_engine": "piper" if piper_available else "pyttsx3",
            "piper_available": piper_available
        }
    }

