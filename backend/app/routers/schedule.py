from fastapi import APIRouter, Query
from typing import Optional
from ..services.schedule_service import get_day_schedule_data

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])

@router.get("/day")
def get_day_schedule(date_str: str = Query(..., alias="date"), sprint_id: Optional[int] = None):
    return get_day_schedule_data(date_str, sprint_id)
