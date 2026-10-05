from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.schemas.health import HealthCheckResponse

api_router = APIRouter()

# Include authentication endpoints
api_router.include_router(auth_router)


@api_router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health Check",
    tags=["System"],
)
def get_health() -> HealthCheckResponse:
    """Health check endpoint to verify backend service readiness."""
    return HealthCheckResponse(status="ok", service="datatrust-api")
