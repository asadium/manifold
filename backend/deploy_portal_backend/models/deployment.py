from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class DeploymentPreviewRequest(BaseModel):
    target_id: int
    manifest_path: str


class DeploymentApplyRequest(BaseModel):
    target_id: int
    manifest_path: str


class DeploymentStatus(BaseModel):
    id: int
    target_id: int
    status: Literal["queued", "running", "success", "failed"]
    message: str
    created_at: datetime


class DeploymentPreviewResponse(BaseModel):
    ok: bool
    target_id: int
    manifest_path: str
    summary: str

