from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from app.models.customer import PyObjectId


class AppointmentModel(BaseModel):
    """MongoDB Appointment Entity Model."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    customer_id: str
    customer_name: str
    service: str
    appointment_date: str
    appointment_time: str
    status: str = "Booked"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda dt: dt.isoformat()},
    )
