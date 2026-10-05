from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(default="ok", description="Service health state")
    service: str = Field(default="datatrust-api", description="Service identifier")
