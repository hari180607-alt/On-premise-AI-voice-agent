from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.schemas import RootMessageResponse
from app.routes import api_router
from app.utils.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    global_exception_handler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events manager for startup and shutdown actions."""
    # Startup actions
    await connect_to_mongo()
    yield
    # Shutdown actions
    await close_mongo_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Autonomous Customer Service and Appointment Management System API",
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handlers Configuration
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get(
    "/",
    response_model=RootMessageResponse,
    summary="Root Endpoint",
    description="Primary API status check endpoint returning agent backend status.",
    tags=["Root"],
)
async def root():
    """Returns backend status message."""
    return {"message": "AI Voice Agent Backend Running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
