"""Pydantic schemas package."""
from pydantic import BaseModel, ConfigDict
from typing import Generic, TypeVar, Optional, Any

T = TypeVar("T")


class RootMessageResponse(BaseModel):
    """Schema for root endpoint response."""
    message: str


class StandardResponse(BaseModel, Generic[T]):
    """Standardized API Response schema."""
    success: bool = True
    message: str
    data: Optional[T] = None

    model_config = ConfigDict(arbitrary_types_allowed=True)


from app.schemas.chat import ChatRequest, ChatResponse

