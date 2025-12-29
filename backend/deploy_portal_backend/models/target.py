from datetime import datetime
from pydantic import BaseModel


class TargetBase(BaseModel):
    name: str
    address: str  # VM IP address or hostname
    ssh_key_path: str  # Path to SSH private key file
    ssh_user: str = "root"  # SSH username (default: root)


class TargetCreate(TargetBase):
    pass


class Target(TargetBase):
    id: int
    created_at: datetime

