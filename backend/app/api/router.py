from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.datasets import router as datasets_router
from app.api.quality import router as quality_router
from app.api.anomaly import router as anomaly_router
from app.api.reliability import router as reliability_router
from app.api.history import router as history_router
from app.api.ai import router as ai_router
from app.api.dashboard import router as dashboard_router
from app.schemas.health import HealthCheckResponse

api_router = APIRouter()

# Include feature endpoints
api_router.include_router(auth_router)
api_router.include_router(datasets_router)
api_router.include_router(quality_router)
api_router.include_router(anomaly_router)
api_router.include_router(reliability_router)
api_router.include_router(history_router)
api_router.include_router(ai_router)
api_router.include_router(dashboard_router)



@api_router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health Check",
    tags=["System"],
)
def get_health() -> HealthCheckResponse:
    """Health check endpoint to verify backend service readiness."""
    return HealthCheckResponse(status="ok", service="datatrust-api")
