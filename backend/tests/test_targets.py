import pytest
from fastapi.testclient import TestClient
from deploy_portal_backend.main import app

client = TestClient(app)


def test_list_targets_empty():
    """Test listing targets when none exist."""
    response = client.get("/api/targets")
    assert response.status_code == 200
    assert response.json() == []


def test_create_target():
    """Test creating a target."""
    response = client.post(
        "/api/targets",
        json={
            "name": "Test Cluster",
            "type": "kubernetes",
            "address": "cluster.example.com"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Cluster"
    assert data["type"] == "kubernetes"
    assert data["address"] == "cluster.example.com"
    assert "id" in data
    assert "created_at" in data


def test_get_target():
    """Test getting a target by ID."""
    # Create a target first
    create_response = client.post(
        "/api/targets",
        json={
            "name": "Test Target",
            "type": "vm",
            "address": "192.168.1.100"
        }
    )
    target_id = create_response.json()["id"]
    
    # Get the target
    response = client.get(f"/api/targets/{target_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == target_id
    assert data["name"] == "Test Target"


def test_get_target_not_found():
    """Test getting a non-existent target."""
    response = client.get("/api/targets/99999")
    assert response.status_code == 404

