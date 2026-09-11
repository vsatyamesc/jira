from pydantic import BaseModel
from typing import Optional

class TaskCreate(BaseModel):
    key: Optional[str] = None  # Optional custom ticket key, e.g. "PROJ-123"
    title: str
    description: Optional[str] = ""
    sprint_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: str = "todo"
    story_points: float = 1.0
    allocated_hours: Optional[float] = None
    allocated_time_str: Optional[str] = None
    priority: str = "medium"
    color: Optional[str] = "#0071e3"
    assignee: Optional[str] = "Me"

class TaskUpdate(BaseModel):
    key: Optional[str] = None  # Allow editing custom ticket key
    title: Optional[str] = None
    description: Optional[str] = None
    sprint_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: Optional[str] = None
    story_points: Optional[float] = None
    allocated_hours: Optional[float] = None
    allocated_time_str: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None
    assignee: Optional[str] = None

class SubtaskCreate(BaseModel):
    key: Optional[str] = None  # Optional custom subtask key, e.g. "PROJ-101-1"
    title: str
    allocated_hours: Optional[float] = None
    allocated_time_str: Optional[str] = None
    status: str = "todo"
    assignee: Optional[str] = "Me"
