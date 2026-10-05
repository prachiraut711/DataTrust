from fastapi.testclient import TestClient


def test_successful_registration(client: TestClient):
    """Verify that a user can register, automatically receiving a token and default workspace."""
    payload = {
        "email": "analyst@datatrust.io",
        "password": "StrongPassword123!",
        "full_name": "Data Analyst",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data

    user = data["user"]
    assert user["email"] == "analyst@datatrust.io"
    assert user["full_name"] == "Data Analyst"
    assert "password_hash" not in user

    # Ensure a default workspace was provisioned
    assert len(user["workspaces"]) == 1
    assert user["workspaces"][0]["name"] == "Data Analyst's Workspace"


def test_duplicate_registration(client: TestClient):
    """Verify that registering with an already existing email returns a conflict error."""
    payload = {
        "email": "engineer@datatrust.io",
        "password": "StrongPassword123!",
        "full_name": "Data Engineer",
    }
    # Initial registration
    res1 = client.post("/api/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt duplicate registration
    res2 = client.post("/api/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


def test_registration_password_length_validation(client: TestClient):
    """Verify that registering with a password under 8 characters fails validation."""
    payload = {
        "email": "user@datatrust.io",
        "password": "short",
        "full_name": "Test User",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


def test_successful_login(client: TestClient):
    """Verify that a registered user can log in with their credentials to receive a JWT."""
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "email": "scientist@datatrust.io",
            "password": "SecurePassword123!",
            "full_name": "Data Scientist",
        },
    )

    # Login
    response = client.post(
        "/api/auth/login",
        json={
            "email": "scientist@datatrust.io",
            "password": "SecurePassword123!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "scientist@datatrust.io"


def test_invalid_login(client: TestClient):
    """Verify that invalid credentials return a 401 unauthorized error."""
    # Attempt login with non-existent user
    res1 = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent@datatrust.io",
            "password": "RandomPassword123!",
        },
    )
    assert res1.status_code == 401

    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": "dev@datatrust.io",
            "password": "CorrectPassword123!",
            "full_name": "Developer",
        },
    )

    # Attempt login with wrong password
    res2 = client.post(
        "/api/auth/login",
        json={
            "email": "dev@datatrust.io",
            "password": "WrongPassword999!",
        },
    )
    assert res2.status_code == 401
    assert "incorrect email or password" in res2.json()["detail"].lower()


def test_authenticated_me(client: TestClient):
    """Verify that GET /api/auth/me returns the profile of the authenticated user."""
    reg_response = client.post(
        "/api/auth/register",
        json={
            "email": "lead@datatrust.io",
            "password": "LeadPassword123!",
            "full_name": "Prachi Lead",
        },
    )
    token = reg_response.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "lead@datatrust.io"
    assert user_data["full_name"] == "Prachi Lead"
    assert "password_hash" not in user_data
    assert len(user_data["workspaces"]) == 1
    assert user_data["workspaces"][0]["name"] == "Prachi Lead's Workspace"


def test_unauthenticated_me(client: TestClient):
    """Verify that GET /api/auth/me without a token returns a 401 unauthorized error."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_invalid_token_me(client: TestClient):
    """Verify that GET /api/auth/me with a malformed or invalid token returns 401."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.payload"},
    )
    assert response.status_code == 401
