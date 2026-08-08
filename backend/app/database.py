import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("uvicorn.error")


class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


db_manager = Database()


async def connect_to_mongo():
    """Connect to MongoDB Atlas using Motor async driver."""
    try:
        logger.info("Connecting to MongoDB Atlas...")
        db_manager.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000
        )
        db_manager.db = db_manager.client[settings.DATABASE_NAME]
        logger.info(f"Successfully connected to MongoDB database: '{settings.DATABASE_NAME}'")

        # Create performance indexes
        try:
            await db_manager.db["customers"].create_index("phone", unique=True, sparse=True)
            await db_manager.db["customers"].create_index("email", sparse=True)
            await db_manager.db["appointments"].create_index("customer_id")
            await db_manager.db["appointments"].create_index("appointment_date")
            await db_manager.db["appointments"].create_index("status")
            logger.info("MongoDB performance indexes verified successfully.")
        except Exception as idx_err:
            logger.warning(f"Note on index creation: {idx_err}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        # Allow server to start even if DB is temporarily unreachable in dev/test mode


async def close_mongo_connection():
    """Close MongoDB connection gracefully."""
    if db_manager.client:
        logger.info("Closing MongoDB Atlas connection...")
        db_manager.client.close()
        logger.info("MongoDB Atlas connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Dependency helper to return the active MongoDB database instance."""
    if db_manager.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return db_manager.db
