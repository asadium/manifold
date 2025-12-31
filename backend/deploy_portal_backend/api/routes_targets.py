from datetime import datetime
from fastapi import APIRouter, HTTPException
from deploy_portal_backend.models.target import Target, TargetCreate

router = APIRouter()

# In-memory storage
TARGETS: list[Target] = []
TARGET_ID_COUNTER = 1


@router.get("/targets", response_model=list[Target])
async def list_targets():
    """List all targets."""
    return TARGETS


@router.post("/targets", response_model=Target, status_code=201)
async def create_target(target: TargetCreate):
    """Create a new target."""
    global TARGET_ID_COUNTER
    
    new_target = Target(
        id=TARGET_ID_COUNTER,
        name=target.name,
        address=target.address,
        ssh_key_path=target.ssh_key_path,
        ssh_user=target.ssh_user,
        created_at=datetime.now()
    )
    
    TARGET_ID_COUNTER += 1
    TARGETS.append(new_target)
    
    return new_target


@router.get("/targets/{target_id}", response_model=Target)
async def get_target(target_id: int):
    """Get a single target by ID."""
    for target in TARGETS:
        if target.id == target_id:
            return target
    
    raise HTTPException(status_code=404, detail="Target not found")


def get_target_by_id(target_id: int) -> Target | None:
    """Helper function to get target by ID."""
    for target in TARGETS:
        if target.id == target_id:
            return target
    return None


@router.get("/targets/{target_id}/containers")
async def get_target_containers(target_id: int):
    """Get all containers deployed on a target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    containers = DeploymentService.list_containers(target)
    return containers


@router.get("/targets/{target_id}/containers/{container_name}/logs")
async def get_container_logs(target_id: int, container_name: str, lines: int = 100):
    """Get logs for a specific container on a target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    logs = DeploymentService.get_container_logs(target, container_name, lines)
    return {"logs": logs}


@router.get("/targets/{target_id}/containers/{container_name}/env")
async def get_container_env(target_id: int, container_name: str):
    """Get environment variables for a specific container."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    env_vars = DeploymentService.get_container_env(target, container_name)
    return {"env": env_vars}


@router.put("/targets/{target_id}/containers/{container_name}/env")
async def update_container_env(target_id: int, container_name: str, env_vars: dict):
    """Update environment variables for a container (restarts container)."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    result = DeploymentService.update_container_env(target, container_name, env_vars.get("env", {}))
    return {"message": result}


@router.get("/targets/{target_id}/env")
async def get_target_env(target_id: int):
    """Get environment variables for a VM target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    env_vars = DeploymentService.get_target_env(target)
    return {"env": env_vars}


@router.put("/targets/{target_id}/env")
async def update_target_env(target_id: int, env_vars: dict):
    """Update environment variables for a VM target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    result = DeploymentService.update_target_env(target, env_vars.get("env", {}))
    return {"message": result}


@router.post("/targets/{target_id}/containers/{container_name}/stop")
async def stop_container(target_id: int, container_name: str):
    """Stop a container on a target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    result = DeploymentService.stop_container(target, container_name)
    return {"message": result}


@router.delete("/targets/{target_id}/containers/{container_name}")
async def delete_container(target_id: int, container_name: str):
    """Delete a container on a target."""
    target = get_target_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    from deploy_portal_backend.services.deployment import DeploymentService
    result = DeploymentService.delete_container(target, container_name)
    return {"message": result}

