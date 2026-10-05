from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="DataTrust API - Data Reliability & Quality Engineering Platform",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["System"])
def root():
    """Root endpoint welcoming API consumers and pointing to documentation."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
    }
