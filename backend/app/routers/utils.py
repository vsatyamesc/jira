from fastapi import APIRouter, HTTPException
from typing import Optional
from ..database import get_db_connection
from ..services.duration_parser import parse_jira_time_str, format_hours_to_jira_str

router = APIRouter(prefix="/api/utils", tags=["Utilities"])

@router.get("/parse-duration")
def parse_duration_api(duration: str, hours_per_day: float = 8.0, sprint_id: Optional[int] = None):
    if sprint_id:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT hours_per_day FROM sprints WHERE id = ?", (sprint_id,))
        r = c.fetchone()
        conn.close()
        if r and r["hours_per_day"]:
            hours_per_day = r["hours_per_day"]

    try:
        hours = parse_jira_time_str(duration, hours_per_day=hours_per_day)
        formatted = format_hours_to_jira_str(hours, hours_per_day=hours_per_day)
        return {
            "input": duration,
            "hours": hours,
            "hours_per_day": hours_per_day,
            "formatted": formatted,
            "minutes": int(round(hours * 60))
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
