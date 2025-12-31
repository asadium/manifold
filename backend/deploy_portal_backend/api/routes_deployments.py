import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from deploy_portal_backend.models.deployment import (
    DeploymentPreviewRequest,
    DeploymentPreviewResponse,
    DeploymentApplyRequest,
    DeploymentStatus,
)
from deploy_portal_backend.api.routes_targets import get_target_by_id
from deploy_portal_backend.services.deployment import DeploymentService

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory storage
DEPLOYMENTS: list[DeploymentStatus] = []
DEPLOYMENT_ID_COUNTER = 1

# Log storage: deployment_id -> list of log entries
DEPLOYMENT_LOGS: dict[int, list[dict[str, str]]] = {}


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


def add_deployment_log(deployment_id: int, level: str, message: str):
    """Add a log entry for a deployment."""
    global DEPLOYMENT_LOGS
    if deployment_id not in DEPLOYMENT_LOGS:
        DEPLOYMENT_LOGS[deployment_id] = []
    
    from datetime import datetime
    DEPLOYMENT_LOGS[deployment_id].append({
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "message": message
    })


def update_deployment_status(deployment_id: int, status: str, message: str):
    """Update deployment status in the list."""
    global DEPLOYMENTS
    for deployment in DEPLOYMENTS:
        if deployment.id == deployment_id:
            # Create new deployment object with updated status
            updated_deployment = DeploymentStatus(
                id=deployment.id,
                target_id=deployment.target_id,
                image=deployment.image,
                container_name=deployment.container_name,
                compose_file_path=deployment.compose_file_path,
                status=status,
                message=message,
                created_at=deployment.created_at
            )
            # Replace in list
            index = DEPLOYMENTS.index(deployment)
            DEPLOYMENTS[index] = updated_deployment
            break


@router.post("/deployments/apply", response_model=DeploymentStatus, status_code=201)
async def apply_deployment(request: DeploymentApplyRequest, background_tasks: BackgroundTasks):
    """Apply a Docker deployment."""
    global DEPLOYMENT_ID_COUNTER
    
    target = get_target_by_id(request.target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Create deployment record with "queued" status
    if request.compose_file_path:
        deployment = DeploymentStatus(
            id=DEPLOYMENT_ID_COUNTER,
            target_id=request.target_id,
            compose_file_path=request.compose_file_path,
            status="queued",
            message=f"Deployment queued to {target.address}",
            created_at=datetime.now()
        )
    else:
        deployment = DeploymentStatus(
            id=DEPLOYMENT_ID_COUNTER,
            target_id=request.target_id,
            image=request.image,
            container_name=request.container_name,
            status="queued",
            message=f"Deployment queued to {target.address}",
            created_at=datetime.now()
        )
    
    DEPLOYMENT_ID_COUNTER += 1
    DEPLOYMENTS.append(deployment)
    
    # Initialize logs for this deployment
    add_deployment_log(deployment.id, "INFO", f"Deployment {deployment.id} queued for background execution")
    
    # Execute deployment in background
    def execute_deployment():
        add_deployment_log(deployment.id, "INFO", f"Starting background deployment {deployment.id} for target {target.name} ({target.address})")
        logger.info(f"Starting background deployment {deployment.id} for target {target.name} ({target.address})")
        try:
            update_deployment_status(deployment.id, "running", "Deployment in progress...")
            add_deployment_log(deployment.id, "INFO", "Deployment status: running")
            add_deployment_log(deployment.id, "INFO", f"Executing deployment commands...")
            logger.info(f"Deployment {deployment.id}: Executing deployment commands...")
            
            # Capture logs from deployment service
            result = DeploymentService.deploy(request, target, deployment.id)
            
            add_deployment_log(deployment.id, "INFO", f"Deployment completed successfully: {result}")
            logger.info(f"Deployment {deployment.id}: Success - {result}")
            update_deployment_status(deployment.id, "success", result)
        except Exception as e:
            error_msg = f"Deployment failed: {str(e)}"
            add_deployment_log(deployment.id, "ERROR", error_msg)
            logger.error(f"Deployment {deployment.id}: Failed - {error_msg}", exc_info=True)
            update_deployment_status(deployment.id, "failed", error_msg)
    
    background_tasks.add_task(execute_deployment)
    logger.info(f"Deployment {deployment.id} queued for background execution")
    
    return deployment


@router.get("/deployments", response_model=list[DeploymentStatus])
async def list_deployments():
    """List all deployments."""
    return DEPLOYMENTS


@router.get("/deployments/{deployment_id}/logs")
async def get_deployment_logs(deployment_id: int):
    """Get logs for a specific deployment."""
    if deployment_id not in DEPLOYMENT_LOGS:
        return []
    return DEPLOYMENT_LOGS[deployment_id]

