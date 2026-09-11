"""
Root entry point for ChronoJira FastAPI Server.
Modular implementation lives in backend/app/.
"""
from backend.app.main import app, create_app
from backend.app.database import get_db_connection, init_db, seed_data
from backend.app.services.duration_parser import (
    parse_jira_time_str,
    format_hours_to_jira_str,
    parse_time_to_minutes,
    calculate_duration_hours,
    add_hours_to_time,
    is_date_off,
)
from backend.app.services.collision_service import check_overlap
from backend.app.schemas import (
    SprintCreate,
    SprintUpdate,
    SprintCloseRequest,
    TaskCreate,
    TaskUpdate,
    SubtaskCreate,
    TimeSlotCreate,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
