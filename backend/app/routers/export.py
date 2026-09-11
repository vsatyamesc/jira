from fastapi import APIRouter, Response
from typing import Optional
from ..services.export_service import generate_timesheet_csv

router = APIRouter(prefix="/api/export", tags=["Export"])

@router.get("/csv")
def export_timesheet_csv(sprint_id: Optional[int] = None):
    csv_data, filename = generate_timesheet_csv(sprint_id)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
