from fastapi import APIRouter, HTTPException
from typing import Optional
from ..database import get_db_connection
from ..schemas.sprint import SprintCreate, SprintUpdate, SprintCloseRequest

router = APIRouter(prefix="/api/sprints", tags=["Sprints"])

@router.get("")
def list_sprints():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sprints ORDER BY id DESC")
    rows = cursor.fetchall()

    sprints = []
    for r in rows:
        s = dict(r)
        sid = s["id"]
        cursor.execute("SELECT COUNT(id) as total_tasks, COALESCE(SUM(story_points), 0) as total_sp FROM tasks WHERE sprint_id = ?", (sid,))
        t_stat = cursor.fetchone()
        cursor.execute("SELECT COALESCE(SUM(ts.duration_hours), 0) as logged FROM time_slots ts JOIN tasks t ON ts.task_id = t.id WHERE t.sprint_id = ?", (sid,))
        l_stat = cursor.fetchone()

        s["total_tasks"] = t_stat["total_tasks"]
        s["total_story_points"] = t_stat["total_sp"]
        s["logged_hours"] = round(l_stat["logged"], 1)
        s["budgeted_hours"] = round(s["total_story_points"] * (s["hours_per_sp"] or 8.0), 1)
        sprints.append(s)

    conn.close()
    return sprints

@router.get("/active")
def get_active_sprint(sprint_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if sprint_id:
        cursor.execute("SELECT * FROM sprints WHERE id = ?", (sprint_id,))
    else:
        cursor.execute("SELECT * FROM sprints WHERE status = 'active' ORDER BY id DESC LIMIT 1")

    row = cursor.fetchone()
    if not row:
        cursor.execute("SELECT * FROM sprints ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="No sprint found")

    sprint = dict(row)
    sid = sprint["id"]
    hours_per_sp = sprint["hours_per_sp"] or 8.0

    cursor.execute("""
        SELECT 
            COUNT(id) as total_tasks,
            COALESCE(SUM(story_points), 0) as total_sp
        FROM tasks 
        WHERE sprint_id = ?
    """, (sid,))
    task_stats = dict(cursor.fetchone())

    cursor.execute("""
        SELECT COALESCE(SUM(ts.duration_hours), 0) as total_logged_hours
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE t.sprint_id = ?
    """, (sid,))
    logged_hours = cursor.fetchone()["total_logged_hours"]

    total_sp = task_stats["total_sp"]
    budgeted_hours = round(total_sp * hours_per_sp, 1)
    progress_pct = round((logged_hours / budgeted_hours * 100), 1) if budgeted_hours > 0 else 0.0

    conn.close()
    return {
        **sprint,
        "total_tasks": task_stats["total_tasks"],
        "total_story_points": total_sp,
        "budgeted_hours": budgeted_hours,
        "logged_hours": round(logged_hours, 1),
        "remaining_hours": max(0.0, round(budgeted_hours - logged_hours, 1)),
        "progress_percentage": min(100.0, progress_pct)
    }

@router.post("")
def create_sprint(sprint: SprintCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    if sprint.status == "active":
        cursor.execute("UPDATE sprints SET status = 'planned' WHERE status = 'active'")

    cursor.execute("""
        INSERT INTO sprints (name, goal, start_date, end_date, hours_per_sp, hours_per_day, week_offs, day_offs, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sprint.name, sprint.goal, sprint.start_date, sprint.end_date,
        sprint.hours_per_sp, sprint.hours_per_day, sprint.week_offs, sprint.day_offs, sprint.status
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "message": "Sprint created successfully"}

@router.put("/{sprint_id}")
def update_sprint(sprint_id: int, sprint: SprintUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    if sprint.status == "active":
        cursor.execute("UPDATE sprints SET status = 'planned' WHERE status = 'active' AND id != ?", (sprint_id,))

    fields = []
    values = []
    for k, v in sprint.dict(exclude_unset=True).items():
        if v is not None:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        conn.close()
        return {"message": "No changes requested"}
    values.append(sprint_id)
    cursor.execute(f"UPDATE sprints SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return {"message": "Sprint updated successfully"}

@router.post("/{sprint_id}/close")
def close_sprint(sprint_id: int, req: SprintCloseRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE tasks 
        SET sprint_id = ? 
        WHERE sprint_id = ? AND status != 'done'
    """, (req.move_incomplete_to, sprint_id))

    cursor.execute("UPDATE sprints SET status = 'closed' WHERE id = ?", (sprint_id,))

    cursor.execute("SELECT id FROM sprints WHERE status = 'active' LIMIT 1")
    if not cursor.fetchone():
        cursor.execute("SELECT id FROM sprints WHERE status = 'planned' ORDER BY start_date ASC LIMIT 1")
        planned = cursor.fetchone()
        if planned:
            cursor.execute("UPDATE sprints SET status = 'active' WHERE id = ?", (planned["id"],))

    conn.commit()
    conn.close()
    return {"message": "Sprint closed successfully"}
