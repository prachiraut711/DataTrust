import re
import uuid
from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.workspace import WorkspaceResponse

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserBase(BaseModel):
    email: str = Field(..., max_length=255, description="User work or personal email")
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name of user")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Invalid email format")
        return cleaned


class UserResponse(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    workspaces: List[WorkspaceResponse] = []

    model_config = ConfigDict(from_attributes=True)
