from pydantic import BaseModel
from typing import Optional

class TimeSlotCreate(BaseModel):
    task_id: int
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: Optional[str] = None
    duration_str: Optional[str] = None  # e.g. "1d 2h", "30m", "45m"
    notes: Optional[str] = ""
    allow_overlap: bool = False
