from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AppointmentCreate(BaseModel):
    """Schema for booking a new appointment."""

    customer_id: str = Field(..., example="66b38c2f1f8b4a2e5d1a2b3c")
    service: str = Field(..., min_length=1, max_length=100, example="General Consultation")
    appointment_date: str = Field(..., example="2026-08-10")
    appointment_time: str = Field(..., example="14:30")
    status: Optional[str] = Field("Booked", example="Booked")


class AppointmentUpdate(BaseModel):
    """Schema for updating an existing appointment."""

    service: Optional[str] = Field(None, min_length=1, max_length=100, example="Specialist Consultation")
    appointment_date: Optional[str] = Field(None, example="2026-08-12")
    appointment_time: Optional[str] = Field(None, example="16:00")
    status: Optional[str] = Field(None, example="Completed")


class AppointmentResponse(BaseModel):
    """Schema for returning appointment details."""

    id: str = Field(..., example="66b39f1e1f8b4a2e5d1a9f8e")
    customer_id: str = Field(..., example="66b38c2f1f8b4a2e5d1a2b3c")
    customer_name: str = Field(..., example="John Doe")
    service: str = Field(..., example="General Consultation")
    appointment_date: str = Field(..., example="2026-08-10")
    appointment_time: str = Field(..., example="14:30")
    status: str = Field(..., example="Booked")
    created_at: datetime = Field(..., example="2026-08-07T20:30:00Z")

    model_config = ConfigDict(from_attributes=True)
