from datetime import datetime
from pydantic import BaseModel


class TargetBase(BaseModel):
    name: str
    address: str  # VM IP address or hostname


class TargetCreate(TargetBase):
    pass


class Target(TargetBase):
    id: int
    created_at: datetime

