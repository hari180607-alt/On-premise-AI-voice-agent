from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.customer_service import CustomerService
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate


class AppointmentService:
    """Service layer handling async MongoDB operations for Appointments."""

    COLLECTION_NAME = "appointments"

    @classmethod
    def get_collection(cls, db: AsyncIOMotorDatabase = None):
        if db is None:
            db = get_database()
        return db[cls.COLLECTION_NAME]

    @staticmethod
    def _validate_object_id(appointment_id: str) -> ObjectId:
        """Validate and convert string to BSON ObjectId."""
        if not ObjectId.is_valid(appointment_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Appointment ID format: '{appointment_id}'"
            )
        return ObjectId(appointment_id)

    @classmethod
    def _format_appointment(cls, doc: dict) -> dict:
        """Format MongoDB document into dictionary matching AppointmentResponse schema."""
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def create_appointment(cls, appointment_in: AppointmentCreate) -> dict:
        """Create a new appointment after verifying that the customer exists."""
        # 1. Verify customer exists and retrieve customer details
        customer = await CustomerService.get_customer_by_id(appointment_in.customer_id)

        # 2. Build appointment document
        collection = cls.get_collection()
        appointment_doc = appointment_in.model_dump()
        appointment_doc["customer_name"] = customer["name"]
        appointment_doc["created_at"] = datetime.now(timezone.utc)

        if not appointment_doc.get("status"):
            appointment_doc["status"] = "Booked"

        result = await collection.insert_one(appointment_doc)
        appointment_doc["_id"] = result.inserted_id

        return cls._format_appointment(appointment_doc)

    @classmethod
    async def get_appointments(
        cls,
        skip: int = 0,
        limit: int = 100,
        status_filter: Optional[str] = None,
        customer_id_filter: Optional[str] = None
    ) -> List[dict]:
        """Retrieve paginated list of appointments with optional status & customer filtering."""
        collection = cls.get_collection()
        query = {}

        if status_filter:
            query["status"] = status_filter
        if customer_id_filter:
            query["customer_id"] = customer_id_filter

        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        appointments = await cursor.to_list(length=limit)
        return [cls._format_appointment(doc) for doc in appointments]

    @classmethod
    async def get_appointment_by_id(cls, appointment_id: str) -> dict:
        """Retrieve appointment document by ID."""
        obj_id = cls._validate_object_id(appointment_id)
        collection = cls.get_collection()

        appointment = await collection.find_one({"_id": obj_id})
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment with ID '{appointment_id}' not found."
            )
        return cls._format_appointment(appointment)

    @classmethod
    async def update_appointment(cls, appointment_id: str, appointment_in: AppointmentUpdate) -> dict:
        """Update fields of an existing appointment by ID."""
        obj_id = cls._validate_object_id(appointment_id)
        collection = cls.get_collection()

        update_data = {k: v for k, v in appointment_in.model_dump(exclude_unset=True).items()}
        if not update_data:
            return await cls.get_appointment_by_id(appointment_id)

        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=True
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment with ID '{appointment_id}' not found."
            )
        return cls._format_appointment(result)

    @classmethod
    async def delete_appointment(cls, appointment_id: str) -> bool:
        """Delete appointment document by ID."""
        obj_id = cls._validate_object_id(appointment_id)
        collection = cls.get_collection()

        result = await collection.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Appointment with ID '{appointment_id}' not found."
            )
        return True
