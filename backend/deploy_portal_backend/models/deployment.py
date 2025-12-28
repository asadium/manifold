from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, model_validator


class DeploymentPreviewRequest(BaseModel):
    target_id: int
    # Single container deployment fields
    image: Optional[str] = None  # Docker image name (e.g., "nginx:latest")
    container_name: Optional[str] = None  # Name for the container
    ports: Optional[str] = None  # Port mapping (e.g., "8080:80")
    # Docker Compose deployment field
    compose_file_path: Optional[str] = None  # Path to docker-compose.yml file
    
    @model_validator(mode='after')
    def validate_deployment_type(self):
        """Ensure either single container OR compose file is provided."""
        has_single_container = self.image is not None and self.container_name is not None
        has_compose_file = self.compose_file_path is not None
        
        if not (has_single_container or has_compose_file):
            raise ValueError("Either provide (image, container_name) OR compose_file_path")
        if has_single_container and has_compose_file:
            raise ValueError("Cannot provide both single container and compose file")
        return self


class DeploymentApplyRequest(BaseModel):
    target_id: int
    # Single container deployment fields
    image: Optional[str] = None  # Docker image name
    container_name: Optional[str] = None  # Name for the container
    ports: Optional[str] = None  # Port mapping (e.g., "8080:80")
    # Docker Compose deployment field
    compose_file_path: Optional[str] = None  # Path to docker-compose.yml file
    
    @model_validator(mode='after')
    def validate_deployment_type(self):
        """Ensure either single container OR compose file is provided."""
        has_single_container = self.image is not None and self.container_name is not None
        has_compose_file = self.compose_file_path is not None
        
        if not (has_single_container or has_compose_file):
            raise ValueError("Either provide (image, container_name) OR compose_file_path")
        if has_single_container and has_compose_file:
            raise ValueError("Cannot provide both single container and compose file")
        return self


class DeploymentStatus(BaseModel):
    id: int
    target_id: int
    # Single container fields (optional)
    image: Optional[str] = None
    container_name: Optional[str] = None
    # Compose file field (optional)
    compose_file_path: Optional[str] = None
    status: Literal["queued", "running", "success", "failed"]
    message: str
    created_at: datetime


class DeploymentPreviewResponse(BaseModel):
    ok: bool
    target_id: int
    # Single container fields (optional)
    image: Optional[str] = None
    container_name: Optional[str] = None
    ports: Optional[str] = None
    # Compose file field (optional)
    compose_file_path: Optional[str] = None
    summary: str

