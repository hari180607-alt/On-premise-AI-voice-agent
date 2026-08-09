from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.customer import router as customer_router
from app.routes.appointment import router as appointment_router
from app.routes.chat import router as chat_router
from app.routes.voice import router as voice_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(customer_router)
api_router.include_router(appointment_router)
api_router.include_router(chat_router)
api_router.include_router(voice_router)



