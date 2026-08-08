from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict


class CustomerCreate(BaseModel):
    """Schema for creating a new customer."""

    name: str = Field(..., min_length=1, max_length=100, example="John Doe")
    phone: str = Field(..., min_length=5, max_length=20, example="+1234567890")
    email: Optional[EmailStr] = Field(None, example="john.doe@example.com")


class CustomerUpdate(BaseModel):
    """Schema for updating an existing customer."""

    name: Optional[str] = Field(None, min_length=1, max_length=100, example="John Doe Updated")
    phone: Optional[str] = Field(None, min_length=5, max_length=20, example="+9876543210")
    email: Optional[EmailStr] = Field(None, example="john.updated@example.com")


class CustomerResponse(BaseModel):
    """Schema for returning customer details."""

    id: str = Field(..., example="66b38c2f1f8b4a2e5d1a2b3c")
    name: str = Field(..., example="John Doe")
    phone: str = Field(..., example="+1234567890")
    email: Optional[str] = Field(None, example="john.doe@example.com")
    created_at: datetime = Field(..., example="2026-08-07T20:30:00Z")

    model_config = ConfigDict(from_attributes=True)
