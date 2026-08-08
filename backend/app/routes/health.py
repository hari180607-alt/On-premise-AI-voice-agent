"""API routes package."""
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
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags")
            if res.status_code == 200:
                ollama_connected = True
                ollama_status = "Connected"
    except Exception as e:
        ollama_status = f"Connection error: {str(e)}"

    return {
        "status": "healthy",
        "database": {
            "connected": db_connected,
            "status": db_status
        },
        "ollama": {
            "connected": ollama_connected,
            "status": ollama_status
        }
    }

