from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    """Service layer handling async MongoDB operations for Customers."""

    COLLECTION_NAME = "customers"

    @classmethod
    def get_collection(cls, db: AsyncIOMotorDatabase = None):
        if db is None:
            db = get_database()
        return db[cls.COLLECTION_NAME]

    @staticmethod
    def _validate_object_id(customer_id: str) -> ObjectId:
        """Validate and convert string to BSON ObjectId."""
        if not ObjectId.is_valid(customer_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Customer ID format: '{customer_id}'"
            )
        return ObjectId(customer_id)

    @classmethod
    def _format_customer(cls, doc: dict) -> dict:
        """Format MongoDB document into dictionary matching CustomerResponse schema."""
        if not doc:
            return None
        doc["id"] = str(doc["_id"])
        return doc

    @classmethod
    async def create_customer(cls, customer_in: CustomerCreate) -> dict:
        """Create a new customer document in MongoDB."""
        collection = cls.get_collection()

        customer_doc = customer_in.model_dump()
        customer_doc["created_at"] = datetime.now(timezone.utc)

        result = await collection.insert_one(customer_doc)
        customer_doc["_id"] = result.inserted_id

        return cls._format_customer(customer_doc)

    @classmethod
    async def get_customers(cls, skip: int = 0, limit: int = 100) -> List[dict]:
        """Retrieve paginated list of customers."""
        collection = cls.get_collection()
        cursor = collection.find().sort("created_at", -1).skip(skip).limit(limit)
        customers = await cursor.to_list(length=limit)
        return [cls._format_customer(doc) for doc in customers]

    @classmethod
    async def get_customer_by_id(cls, customer_id: str) -> dict:
        """Retrieve customer document by ID."""
        obj_id = cls._validate_object_id(customer_id)
        collection = cls.get_collection()

        customer = await collection.find_one({"_id": obj_id})
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{customer_id}' not found."
            )
        return cls._format_customer(customer)

    @classmethod
    async def update_customer(cls, customer_id: str, customer_in: CustomerUpdate) -> dict:
        """Update fields of an existing customer by ID."""
        obj_id = cls._validate_object_id(customer_id)
        collection = cls.get_collection()

        update_data = {k: v for k, v in customer_in.model_dump(exclude_unset=True).items()}
        if not update_data:
            # If no fields provided to update, return current document
            return await cls.get_customer_by_id(customer_id)

        result = await collection.find_one_and_update(
            {"_id": obj_id},
            {"$set": update_data},
            return_document=True
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{customer_id}' not found."
            )
        return cls._format_customer(result)

    @classmethod
    async def delete_customer(cls, customer_id: str) -> bool:
        """Delete customer document by ID."""
        obj_id = cls._validate_object_id(customer_id)
        collection = cls.get_collection()

        result = await collection.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{customer_id}' not found."
            )
        return True
