from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..database import get_db_connection
from ..schemas.time_slot import TimeSlotCreate
from ..services.duration_parser import parse_jira_time_str, calculate_duration_hours, add_hours_to_time
from ..services.collision_service import check_overlap

router = APIRouter(prefix="/api/time-slots", tags=["Time Slots"])

@router.get("")
def list_time_slots(date_str: Optional[str] = Query(None, alias="date"), task_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT ts.*, t.key, t.title, t.color, t.story_points
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE 1=1
    """
    params = []
    if date_str:
        query += " AND ts.date = ?"
        params.append(date_str)
    if task_id:
        query += " AND ts.task_id = ?"
        params.append(task_id)
    query += " ORDER BY ts.date DESC, ts.start_time ASC"
    cursor.execute(query, params)
    slots = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return slots

@router.post("")
def create_time_slot(slot: TimeSlotCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT s.hours_per_day 
        FROM tasks t 
        LEFT JOIN sprints s ON t.sprint_id = s.id 
        WHERE t.id = ?
    """, (slot.task_id,))
    s_row = cursor.fetchone()
    hours_per_day = s_row["hours_per_day"] if (s_row and s_row["hours_per_day"]) else 8.0
    conn.close()

    if slot.duration_str and slot.duration_str.strip():
        try:
            duration = parse_jira_time_str(slot.duration_str, hours_per_day=hours_per_day)
            end_time = add_hours_to_time(slot.start_time, duration)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif slot.end_time:
        try:
            duration = calculate_duration_hours(slot.start_time, slot.end_time)
            end_time = slot.end_time
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        raise HTTPException(status_code=400, detail="Must provide end_time or duration_str (e.g. '1d 2h', '30m')")

    conflicts = check_overlap(slot.date, slot.start_time, end_time)
    if conflicts and not slot.allow_overlap:
        conflict_details = ", ".join([f"{c['key']} ({c['start_time']} - {c['end_time']})" for c in conflicts])
        raise HTTPException(
            status_code=409,
            detail=f"Time slot overlaps with existing item(s): {conflict_details}. Set allow_overlap=true to force."
        )

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO time_slots (task_id, date, start_time, end_time, duration_hours, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (slot.task_id, slot.date, slot.start_time, end_time, duration, slot.notes))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {
        "id": new_id,
        "start_time": slot.start_time,
        "end_time": end_time,
        "duration_hours": duration,
        "had_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
        "message": "Time slot logged successfully"
    }

@router.delete("/{slot_id}")
def delete_time_slot(slot_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM time_slots WHERE id = ?", (slot_id,))
    conn.commit()
    conn.close()
    return {"message": "Time slot removed"}
