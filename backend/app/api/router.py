from fastapi import APIRouter
from app.schemas.health import HealthCheckResponse

api_router = APIRouter()


@api_router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health Check",
    tags=["System"],
)
def get_health() -> HealthCheckResponse:
    """Health check endpoint to verify backend service readiness."""
    return HealthCheckResponse(status="ok", service="datatrust-api")
