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
    """Preview a deployment (stub)."""
    target = get_target_by_id(request.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    return DeploymentPreviewResponse(
        ok=True,
        target_id=request.target_id,
        manifest_path=request.manifest_path,
        summary=f"Would apply manifest to target {request.target_id} (stub)."
    )


@router.post("/deployments/apply", response_model=DeploymentStatus, status_code=201)
async def apply_deployment(request: DeploymentApplyRequest):
    """Apply a deployment (stub)."""
    global DEPLOYMENT_ID_COUNTER
    
    target = get_target_by_id(request.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    deployment = DeploymentStatus(
        id=DEPLOYMENT_ID_COUNTER,
        target_id=request.target_id,
        status="queued",
        message="Deployment queued (stub)",
        created_at=datetime.now()
    )
    
    DEPLOYMENT_ID_COUNTER += 1
    DEPLOYMENTS.append(deployment)
    
    return deployment


@router.get("/deployments", response_model=list[DeploymentStatus])
async def list_deployments():
    """List all deployments."""
    return DEPLOYMENTS

