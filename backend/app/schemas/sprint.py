from pydantic import BaseModel
from typing import Optional

class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = ""
    start_date: str
    end_date: str
    hours_per_sp: float = 8.0
    hours_per_day: float = 8.0
    week_offs: str = "5,6"
    day_offs: Optional[str] = ""
    status: str = "active"

class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    hours_per_sp: Optional[float] = None
    hours_per_day: Optional[float] = None
    week_offs: Optional[str] = None
    day_offs: Optional[str] = None
    status: Optional[str] = None

class SprintCloseRequest(BaseModel):
    move_incomplete_to: Optional[int] = None
