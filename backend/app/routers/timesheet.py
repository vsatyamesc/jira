from fastapi import APIRouter, Query
from typing import Optional
from ..services.timesheet_service import get_timesheet_matrix_data

router = APIRouter(prefix="/api/timesheet", tags=["Timesheet"])

@router.get("")
@router.get("/matrix")
def get_timesheet_matrix(
    sprint_id: Optional[int] = None,
    start_date: Optional[str] = None,
    days_count: int = 7,
    view_mode: str = Query("sprint", pattern="^(week|sprint|all)$")
):
    return get_timesheet_matrix_data(sprint_id, start_date, days_count, view_mode)
