from fastapi import APIRouter, status
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_service import AIService

router = APIRouter(prefix="/chat", tags=["AI Chat Receptionist"])

@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with AI Receptionist",
    description="Interface with local Ollama Qwen3 model acting as an autonomous business receptionist.",
)
async def chat_receptionist(chat_in: ChatRequest):
    """Post chat message and execute agent tool reasoning loop."""
    result = await AIService.chat_agent(
        message=chat_in.message,
        conversation_id=chat_in.conversation_id,
        action=chat_in.action
    )
    return ChatResponse(
        response=result["response"],
        intent=result["intent"],
        action_performed=result["action_performed"]
    )
