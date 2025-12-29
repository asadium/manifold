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

