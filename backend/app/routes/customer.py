from typing import List
from fastapi import APIRouter, status, Query
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Customer",
    description="Add a new customer to the database.",
)
async def create_customer(customer_in: CustomerCreate):
    """Create a new customer document."""
    return await CustomerService.create_customer(customer_in)


@router.get(
    "",
    response_model=List[CustomerResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Customers List",
    description="Retrieve a paginated list of all registered customers.",
)
async def get_customers(
    skip: int = Query(0, ge=0, description="Number of customer records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
):
    """Get all customers with pagination."""
    return await CustomerService.get_customers(skip=skip, limit=limit)


@router.get(
    "/{id}",
    response_model=CustomerResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Customer By ID",
    description="Retrieve customer details by unique MongoDB ObjectId.",
)
async def get_customer(id: str):
    """Get customer by unique ID."""
    return await CustomerService.get_customer_by_id(id)


@router.put(
    "/{id}",
    response_model=CustomerResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Customer",
    description="Update an existing customer's details by ID.",
)
async def update_customer(id: str, customer_in: CustomerUpdate):
    """Update customer details by ID."""
    return await CustomerService.update_customer(id, customer_in)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Customer",
    description="Delete a customer from the database by ID.",
)
async def delete_customer(id: str):
    """Delete customer record by ID."""
    await CustomerService.delete_customer(id)
    return None
