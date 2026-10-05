from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import TokenResponse, UserLogin, UserRegister
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Register a new user, automatically provision a default workspace, and return a JWT access token."""
    # 1. Check if email already exists
    existing_user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # 2. Hash password and create User record
    hashed_pwd = hash_password(payload.password)
    user = User(
        email=payload.email,
        password_hash=hashed_pwd,
        full_name=payload.full_name.strip(),
    )
    db.add(user)
    db.flush()

    # 3. Create default workspace for user
    default_workspace = Workspace(
        name=f"{user.full_name}'s Workspace",
        owner_id=user.id,
    )
    db.add(default_workspace)
    db.commit()

    # 4. Reload user with workspaces relationship eagerly loaded
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.workspaces))
    )
    fresh_user = db.execute(stmt).scalar_one()

    # 5. Generate JWT token
    token = create_access_token(subject=str(fresh_user.id))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(fresh_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and obtain JWT",
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email and password, returning a JWT token and user profile."""
    stmt = (
        select(User)
        .where(User.email == payload.email)
        .options(selectinload(User.workspaces))
    )
    user = db.execute(stmt).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=str(user.id))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the profile and workspaces of the currently authenticated user."""
    return UserResponse.model_validate(current_user)
