from datetime import datetime
from fastapi import APIRouter, HTTPException
from deploy_portal_backend.models.deployment import (
    DeploymentPreviewRequest,
    DeploymentPreviewResponse,
    DeploymentApplyRequest,
    DeploymentStatus,
)
from deploy_portal_backend.api.routes_targets import get_target_by_id

router = APIRouter()

# In-memory storage
DEPLOYMENTS: list[DeploymentStatus] = []
DEPLOYMENT_ID_COUNTER = 1


@router.post("/deployments/preview", response_model=DeploymentPreviewResponse)
async def preview_deployment(request: DeploymentPreviewRequest):
    """Preview a Docker deployment (stub)."""
    target = get_target_by_id(request.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    if request.compose_file_path:
        # Docker Compose deployment
        summary = (
            f"Would deploy Docker Compose stack from '{request.compose_file_path}' "
            f"to VM {target.name} ({target.address})"
        )
        return DeploymentPreviewResponse(
            ok=True,
            target_id=request.target_id,
            compose_file_path=request.compose_file_path,
            summary=summary
        )
    else:
        # Single container deployment
        port_info = f" on ports {request.ports}" if request.ports else ""
        summary = (
            f"Would deploy Docker container '{request.container_name}' "
            f"using image '{request.image}'{port_info} "
            f"to VM {target.name} ({target.address})"
        )
        return DeploymentPreviewResponse(
            ok=True,
            target_id=request.target_id,
            image=request.image,
            container_name=request.container_name,
            ports=request.ports,
            summary=summary
        )


@router.post("/deployments/apply", response_model=DeploymentStatus, status_code=201)
async def apply_deployment(request: DeploymentApplyRequest):
    """Apply a Docker deployment (stub)."""
    global DEPLOYMENT_ID_COUNTER
    
    target = get_target_by_id(request.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    if request.compose_file_path:
        # Docker Compose deployment
        message = (
            f"Docker Compose deployment queued: '{request.compose_file_path}' "
            f"to {target.address}"
        )
        deployment = DeploymentStatus(
            id=DEPLOYMENT_ID_COUNTER,
            target_id=request.target_id,
            compose_file_path=request.compose_file_path,
            status="queued",
            message=message,
            created_at=datetime.now()
        )
    else:
        # Single container deployment
        port_info = f" with ports {request.ports}" if request.ports else ""
        message = (
            f"Docker deployment queued: {request.container_name} "
            f"({request.image}){port_info} to {target.address}"
        )
        deployment = DeploymentStatus(
            id=DEPLOYMENT_ID_COUNTER,
            target_id=request.target_id,
            image=request.image,
            container_name=request.container_name,
            status="queued",
            message=message,
            created_at=datetime.now()
        )
    
    DEPLOYMENT_ID_COUNTER += 1
    DEPLOYMENTS.append(deployment)
    
    return deployment


@router.get("/deployments", response_model=list[DeploymentStatus])
async def list_deployments():
    """List all deployments."""
    return DEPLOYMENTS

