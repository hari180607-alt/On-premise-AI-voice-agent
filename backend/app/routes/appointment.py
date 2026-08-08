from typing import List, Optional
from fastapi import APIRouter, status, Query
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book Appointment",
    description="Book a new appointment after validating customer existence.",
)
async def create_appointment(appointment_in: AppointmentCreate):
    """Create a new appointment."""
    return await AppointmentService.create_appointment(appointment_in)


@router.get(
    "",
    response_model=List[AppointmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Appointments List",
    description="Retrieve a paginated list of appointments with optional status or customer filters.",
)
async def get_appointments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by status e.g. 'Booked', 'Completed', 'Cancelled'"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
):
    """Get appointments list."""
    return await AppointmentService.get_appointments(
        skip=skip,
        limit=limit,
        status_filter=status,
        customer_id_filter=customer_id
    )


@router.get(
    "/{id}",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Appointment By ID",
    description="Retrieve appointment details by unique ID.",
)
async def get_appointment(id: str):
    """Get appointment by unique ID."""
    return await AppointmentService.get_appointment_by_id(id)


@router.put(
    "/{id}",
    response_model=AppointmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Appointment",
    description="Update appointment details by ID.",
)
async def update_appointment(id: str, appointment_in: AppointmentUpdate):
    """Update appointment details by ID."""
    return await AppointmentService.update_appointment(id, appointment_in)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Appointment",
    description="Delete an appointment record by ID.",
)
async def delete_appointment(id: str):
    """Delete appointment record by ID."""
    await AppointmentService.delete_appointment(id)
    return None
