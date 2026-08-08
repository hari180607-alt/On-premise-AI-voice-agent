from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    message: str = Field(..., example="I want to book an appointment tomorrow at 10 AM")
    conversation_id: Optional[str] = Field(None, example="current-user-session-unique-id")
    action: Optional[str] = Field(None, example="view_appointments")

class ChatResponse(BaseModel):
    response: str = Field(..., example="Sure. What service would you like?")
    intent: str = Field(..., example="book_appointment")
    action_performed: bool = Field(False, example=False)
