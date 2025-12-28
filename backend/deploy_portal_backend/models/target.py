from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class TargetType(str, Enum):
    KUBERNETES = "kubernetes"
    VM = "vm"


class TargetBase(BaseModel):
    name: str
    type: TargetType
    address: str


class TargetCreate(TargetBase):
    pass


class Target(TargetBase):
    id: int
    created_at: datetime

