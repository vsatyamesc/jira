from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime, timedelta
import io
import csv
import re

from database import get_db_connection, init_db

app = FastAPI(title="ChronoJira API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# --- REGEX TIME PARSER ---

DURATION_REGEX = re.compile(
    r'^(?:(?P<weeks>\d+(?:\.\d+)?)\s*(?:w|weeks?))?'
    r'\s*(?:(?P<days>\d+(?:\.\d+)?)\s*(?:d|days?))?'
    r'\s*(?:(?P<hours>\d+(?:\.\d+)?)\s*(?:h|hours?|hrs?|hr))?'
    r'\s*(?:(?P<minutes>\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?|min))?$',
    re.IGNORECASE
)

def parse_jira_time_str(time_str: str, hours_per_day: float = 8.0, working_days_per_week: int = 5) -> float:
    """
    Parses Jira-like duration strings e.g.:
    '1w 2d 4h 30m', '1d', '9h', '30m', '1.5d'
    1d = hours_per_day (e.g. 8.0 or 9.0)
    1h = 60m
    1w = working_days_per_week * hours_per_day
    """
    clean_str = time_str.strip()
    if not clean_str:
        return 0.0

    try:
        return round(float(clean_str), 2)
    except ValueError:
        pass

    if ":" in clean_str:
        parts = clean_str.split(":")
        return round(int(parts[0]) + int(parts[1]) / 60.0, 2)

    match = DURATION_REGEX.match(clean_str)
    if not match or not any(match.groupdict().values()):
        raise ValueError(f"Invalid duration string '{time_str}'. Use formats like '1d 2h', '30m', '1.5d', '2w'.")

    g = match.groupdict()
    w = float(g.get("weeks") or 0)
    d = float(g.get("days") or 0)
    h = float(g.get("hours") or 0)
    m = float(g.get("minutes") or 0)

    total_hours = (w * working_days_per_week * hours_per_day) + (d * hours_per_day) + h + (m / 60.0)
    return round(total_hours, 2)

def format_hours_to_jira_str(hours: float, hours_per_day: float = 8.0) -> str:
    if hours <= 0:
        return "0m"
    total_minutes = int(round(hours * 60))
    day_minutes = int(round(hours_per_day * 60))

    d = total_minutes // day_minutes
    rem = total_minutes % day_minutes
    h = rem // 60
    m = rem % 60

    parts = []
    if d > 0:
        parts.append(f"{d}d")
    if h > 0:
        parts.append(f"{h}h")
    if m > 0:
        parts.append(f"{m}m")
    return " ".join(parts) if parts else f"{hours}h"

def parse_time_to_minutes(time_str: str) -> int:
    parts = time_str.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])

def calculate_duration_hours(start_time: str, end_time: str) -> float:
    start_min = parse_time_to_minutes(start_time)
    end_min = parse_time_to_minutes(end_time)
    if end_min <= start_min:
        raise ValueError("End time must be after start time")
    return round((end_min - start_min) / 60.0, 2)

def add_hours_to_time(start_time: str, hours: float) -> str:
    start_min = parse_time_to_minutes(start_time)
    end_min = start_min + int(round(hours * 60))
    h = (end_min // 60) % 24
    m = end_min % 60
    return f"{h:02d}:{m:02d}"

def is_date_off(d: date, week_offs_str: str, day_offs_str: str):
    """
    week_offs_str: comma-separated days of week e.g. "5,6" (0=Mon, 6=Sun)
    day_offs_str: comma-separated ISO date strings e.g. "2026-09-15"
    """
    week_offs = [int(x.strip()) for x in week_offs_str.split(",") if x.strip().isdigit()]
    if d.weekday() in week_offs:
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return True, f"Week Off ({day_names[d.weekday()]})"

    if day_offs_str:
        day_offs = [x.strip() for x in day_offs_str.split(",") if x.strip()]
        if d.isoformat() in day_offs:
            return True, "Day Off / Holiday"

    return False, ""

def check_overlap(date_str: str, start_str: str, end_str: str, exclude_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT ts.id, ts.start_time, ts.end_time, ts.task_id, t.key, t.title
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.date = ?
    """
    params = [date_str]
    if exclude_id:
        query += " AND ts.id != ?"
        params.append(exclude_id)
    cursor.execute(query, params)
    slots = cursor.fetchall()
    conn.close()

    new_start = parse_time_to_minutes(start_str)
    new_end = parse_time_to_minutes(end_str)

    conflicts = []
    for s in slots:
        curr_start = parse_time_to_minutes(s["start_time"])
        curr_end = parse_time_to_minutes(s["end_time"])
        if new_start < curr_end and new_end > curr_start:
            conflicts.append({
                "id": s["id"],
                "key": s["key"],
                "title": s["title"],
                "start_time": s["start_time"],
                "end_time": s["end_time"]
            })
    return conflicts

# --- PYDANTIC SCHEMAS ---

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
    move_incomplete_to: Optional[int] = None # None means move to backlog

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    sprint_id: Optional[int] = None
    parent_id: Optional[int] = None
    status: str = "todo"
    story_points: float = 1.0
    allocated_hours: Optional[float] = None
    allocated_time_str: Optional[str] = None
    priority: str = "medium"
    color: Optional[str] = "#6366f1"
    assignee: Optional[str] = "Me"

class TaskUpdate(BaseModel):
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
    title: str
    allocated_hours: Optional[float] = None
    allocated_time_str: Optional[str] = None
    status: str = "todo"
    assignee: Optional[str] = "Me"

class TimeSlotCreate(BaseModel):
    task_id: int
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: Optional[str] = None
    duration_str: Optional[str] = None # e.g. "1d 2h", "30m", "45m"
    notes: Optional[str] = ""
    allow_overlap: bool = False

# --- UTILITIES API ---

@app.get("/api/utils/parse-duration")
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

# --- SPRINTS ENDPOINTS ---

@app.get("/api/sprints")
def list_sprints():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sprints ORDER BY id DESC")
    rows = cursor.fetchall()
    
    sprints = []
    for r in rows:
        s = dict(r)
        sid = s["id"]
        # Summary counts
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

@app.get("/api/sprints/active")
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

@app.post("/api/sprints")
def create_sprint(sprint: SprintCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # If new sprint is active, deactivate others
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

@app.put("/api/sprints/{sprint_id}")
def update_sprint(sprint_id: int, sprint: SprintUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # If setting to active, demote existing active sprint
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

@app.post("/api/sprints/{sprint_id}/close")
def close_sprint(sprint_id: int, req: SprintCloseRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Move incomplete tasks if requested
    cursor.execute("""
        UPDATE tasks 
        SET sprint_id = ? 
        WHERE sprint_id = ? AND status != 'done'
    """, (req.move_incomplete_to, sprint_id))

    # Mark sprint as closed
    cursor.execute("UPDATE sprints SET status = 'closed' WHERE id = ?", (sprint_id,))

    # If no other sprint is active, pick the earliest planned sprint and make it active
    cursor.execute("SELECT id FROM sprints WHERE status = 'active' LIMIT 1")
    if not cursor.fetchone():
        cursor.execute("SELECT id FROM sprints WHERE status = 'planned' ORDER BY start_date ASC LIMIT 1")
        planned = cursor.fetchone()
        if planned:
            cursor.execute("UPDATE sprints SET status = 'active' WHERE id = ?", (planned["id"],))

    conn.commit()
    conn.close()
    return {"message": "Sprint closed successfully"}

# --- TASKS ENDPOINTS ---

@app.get("/api/tasks")
def list_tasks(sprint_id: Optional[int] = None, all_tasks: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()

    if sprint_id:
        cursor.execute("SELECT hours_per_sp, hours_per_day FROM sprints WHERE id = ?", (sprint_id,))
    else:
        cursor.execute("SELECT hours_per_sp, hours_per_day FROM sprints WHERE status = 'active' LIMIT 1")
    sprint_row = cursor.fetchone()
    hours_per_sp = sprint_row["hours_per_sp"] if sprint_row else 8.0
    hours_per_day = sprint_row["hours_per_day"] if sprint_row else 8.0

    query = """
        SELECT 
            t.*,
            COALESCE(SUM(ts.duration_hours), 0) as logged_hours,
            COUNT(ts.id) as time_slots_count
        FROM tasks t
        LEFT JOIN time_slots ts ON t.id = ts.task_id
        WHERE 1=1
    """
    params = []
    if not all_tasks:
        # Default: list top-level tasks on board
        query += " AND t.parent_id IS NULL"
    if sprint_id:
        query += " AND t.sprint_id = ?"
        params.append(sprint_id)
    
    query += " GROUP BY t.id ORDER BY t.id ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    tasks = []
    for r in rows:
        item = dict(r)
        sp = item["story_points"] or 0.0

        # Budget calculation: use allocated_hours if specified, otherwise SP * hours_per_sp
        if item.get("allocated_hours") and item["allocated_hours"] > 0:
            budget = round(item["allocated_hours"], 1)
        else:
            budget = round(sp * hours_per_sp, 1)

        # Fetch child subtasks
        cursor.execute("""
            SELECT sub.*, COALESCE(SUM(sts.duration_hours), 0) as sub_logged_hours
            FROM tasks sub
            LEFT JOIN time_slots sts ON sub.id = sts.task_id
            WHERE sub.parent_id = ?
            GROUP BY sub.id
            ORDER BY sub.id ASC
        """, (item["id"],))
        sub_rows = cursor.fetchall()
        subtasks = []
        sub_logged_total = 0.0
        done_count = 0
        for sr in sub_rows:
            sd = dict(sr)
            sub_logged_total += sd["sub_logged_hours"]
            if sd["status"] == "done":
                done_count += 1
            subtasks.append(sd)

        total_logged = round(item["logged_hours"] + sub_logged_total, 2)
        pct = round((total_logged / budget * 100), 1) if budget > 0 else 0.0

        item["hours_per_sp"] = hours_per_sp
        item["hours_per_day"] = hours_per_day
        item["budgeted_hours"] = budget
        item["allocated_hours"] = budget
        item["allocated_jira_str"] = format_hours_to_jira_str(budget, hours_per_day=hours_per_day)
        item["logged_hours"] = total_logged
        item["logged_jira_str"] = format_hours_to_jira_str(total_logged, hours_per_day=hours_per_day)
        item["remaining_hours"] = max(0.0, round(budget - total_logged, 2))
        item["percent_spent"] = pct
        item["subtasks"] = subtasks
        item["subtasks_count"] = len(subtasks)
        item["subtasks_done_count"] = done_count
        tasks.append(item)

    conn.close()
    return tasks

@app.post("/api/tasks")
def create_task(task: TaskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT MAX(id) as max_id FROM tasks")
    row = cursor.fetchone()
    next_num = (row["max_id"] or 0) + 101
    task_key = f"CJ-{next_num}"

    sprint_id = task.sprint_id
    if not sprint_id:
        cursor.execute("SELECT id, hours_per_day FROM sprints WHERE status = 'active' LIMIT 1")
        s = cursor.fetchone()
        sprint_id = s["id"] if s else None
        hours_per_day = s["hours_per_day"] if s else 8.0
    else:
        cursor.execute("SELECT hours_per_day FROM sprints WHERE id = ?", (sprint_id,))
        s = cursor.fetchone()
        hours_per_day = s["hours_per_day"] if s else 8.0

    allocated_hours = task.allocated_hours
    if task.allocated_time_str and task.allocated_time_str.strip():
        try:
            allocated_hours = parse_jira_time_str(task.allocated_time_str, hours_per_day=hours_per_day)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    cursor.execute("""
        INSERT INTO tasks (key, title, description, sprint_id, parent_id, status, story_points, allocated_hours, priority, color, assignee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (task_key, task.title, task.description, sprint_id, task.parent_id, task.status, task.story_points, allocated_hours, task.priority, task.color, task.assignee))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "key": task_key, "message": "Task created successfully"}

@app.post("/api/tasks/{parent_id}/subtasks")
def create_subtask(parent_id: int, subtask: SubtaskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT key, sprint_id FROM tasks WHERE id = ?", (parent_id,))
    parent = cursor.fetchone()
    if not parent:
        conn.close()
        raise HTTPException(status_code=404, detail="Parent task not found")

    cursor.execute("SELECT COUNT(id) as cnt FROM tasks WHERE parent_id = ?", (parent_id,))
    count = cursor.fetchone()["cnt"] + 1
    sub_key = f"{parent['key']}-{count}"

    sprint_id = parent["sprint_id"]
    cursor.execute("SELECT hours_per_day FROM sprints WHERE id = ?", (sprint_id,))
    s_row = cursor.fetchone()
    hours_per_day = s_row["hours_per_day"] if s_row else 8.0

    allocated_hours = subtask.allocated_hours
    if subtask.allocated_time_str and subtask.allocated_time_str.strip():
        try:
            allocated_hours = parse_jira_time_str(subtask.allocated_time_str, hours_per_day=hours_per_day)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    cursor.execute("""
        INSERT INTO tasks (key, title, description, sprint_id, parent_id, status, story_points, allocated_hours, priority, color, assignee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (sub_key, subtask.title, "", sprint_id, parent_id, subtask.status, 0.5, allocated_hours, "medium", "#06b6d4", subtask.assignee))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "key": sub_key, "message": "Subtask created successfully"}

@app.put("/api/subtasks/{subtask_id}/toggle")
def toggle_subtask(subtask_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM tasks WHERE id = ?", (subtask_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Subtask not found")
    new_status = "todo" if row["status"] == "done" else "done"
    cursor.execute("UPDATE tasks SET status = ? WHERE id = ?", (new_status, subtask_id))
    conn.commit()
    conn.close()
    return {"id": subtask_id, "status": new_status}

@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    fields = []
    values = []
    for k, v in task.dict(exclude_unset=True).items():
        if v is not None:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        conn.close()
        return {"message": "No changes"}
    values.append(task_id)
    cursor.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return {"message": "Task updated successfully"}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted successfully"}

# --- TIME SLOTS ENDPOINTS ---

@app.get("/api/time-slots")
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

@app.post("/api/time-slots")
def create_time_slot(slot: TimeSlotCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get active sprint's hours_per_day
    cursor.execute("""
        SELECT s.hours_per_day 
        FROM tasks t 
        LEFT JOIN sprints s ON t.sprint_id = s.id 
        WHERE t.id = ?
    """, (slot.task_id,))
    s_row = cursor.fetchone()
    hours_per_day = s_row["hours_per_day"] if (s_row and s_row["hours_per_day"]) else 8.0
    conn.close()

    # Determine duration and end_time
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

    # Overlap detection
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

@app.delete("/api/time-slots/{slot_id}")
def delete_time_slot(slot_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM time_slots WHERE id = ?", (slot_id,))
    conn.commit()
    conn.close()
    return {"message": "Time slot removed"}

# --- DAY SCHEDULE & COLLISION INSPECTOR ---

@app.get("/api/schedule/day")
def get_day_schedule(date_str: str = Query(..., alias="date"), sprint_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get sprint configurations for week_offs, day_offs, hours_per_day
    if sprint_id:
        cursor.execute("SELECT * FROM sprints WHERE id = ?", (sprint_id,))
    else:
        cursor.execute("SELECT * FROM sprints WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    sprint_row = cursor.fetchone()

    hours_per_day = sprint_row["hours_per_day"] if sprint_row else 8.0
    week_offs = sprint_row["week_offs"] if sprint_row else "5,6"
    day_offs = sprint_row["day_offs"] if sprint_row else ""

    d_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    is_off, off_reason = is_date_off(d_obj, week_offs, day_offs)

    target_day_hours = 0.0 if is_off else hours_per_day

    cursor.execute("""
        SELECT ts.*, t.key, t.title, t.color, t.story_points, t.status
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.date = ?
        ORDER BY ts.start_time ASC
    """, (date_str,))
    rows = cursor.fetchall()
    conn.close()

    slots = []
    total_day_hours = 0.0
    for r in rows:
        d = dict(r)
        total_day_hours += d["duration_hours"]
        slots.append(d)

    collisions = []
    for i in range(len(slots)):
        s1 = slots[i]
        m1_start = parse_time_to_minutes(s1["start_time"])
        m1_end = parse_time_to_minutes(s1["end_time"])
        for j in range(i + 1, len(slots)):
            s2 = slots[j]
            m2_start = parse_time_to_minutes(s2["start_time"])
            m2_end = parse_time_to_minutes(s2["end_time"])
            if m1_start < m2_end and m1_end > m2_start:
                collisions.append({
                    "slot_1": {"id": s1["id"], "key": s1["key"], "range": f"{s1['start_time']}-{s1['end_time']}"},
                    "slot_2": {"id": s2["id"], "key": s2["key"], "range": f"{s2['start_time']}-{s2['end_time']}"}
                })

    free_blocks = []
    work_start = 8 * 60
    work_end = 20 * 60
    current_pointer = work_start

    for s in slots:
        s_start = parse_time_to_minutes(s["start_time"])
        s_end = parse_time_to_minutes(s["end_time"])
        if s_start > current_pointer:
            gap_min = s_start - current_pointer
            start_hh = f"{current_pointer // 60:02d}:{current_pointer % 60:02d}"
            end_hh = f"{s_start // 60:02d}:{s_start % 60:02d}"
            free_blocks.append({
                "start_time": start_hh,
                "end_time": end_hh,
                "duration_hours": round(gap_min / 60.0, 2)
            })
        current_pointer = max(current_pointer, s_end)

    if current_pointer < work_end:
        gap_min = work_end - current_pointer
        start_hh = f"{current_pointer // 60:02d}:{current_pointer % 60:02d}"
        end_hh = f"{work_end // 60:02d}:{work_end % 60:02d}"
        free_blocks.append({
            "start_time": start_hh,
            "end_time": end_hh,
            "duration_hours": round(gap_min / 60.0, 2)
        })

    return {
        "date": date_str,
        "total_day_hours": round(total_day_hours, 2),
        "target_day_hours": target_day_hours,
        "is_off_day": is_off,
        "off_day_reason": off_reason,
        "remaining_day_hours": max(0.0, round(target_day_hours - total_day_hours, 2)),
        "slots_count": len(slots),
        "slots": slots,
        "collisions": collisions,
        "free_blocks": free_blocks
    }

# --- EXCEL TIMESHEET MATRIX API ---

@app.get("/api/timesheet")
def get_timesheet_matrix(sprint_id: Optional[int] = None, start_date: Optional[str] = None, days_count: int = 7):
    conn = get_db_connection()
    cursor = conn.cursor()

    if sprint_id:
        cursor.execute("SELECT * FROM sprints WHERE id = ?", (sprint_id,))
    else:
        cursor.execute("SELECT * FROM sprints WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    sprint_row = cursor.fetchone()
    if not sprint_row:
        cursor.execute("SELECT * FROM sprints ORDER BY id DESC LIMIT 1")
        sprint_row = cursor.fetchone()

    sprint = dict(sprint_row) if sprint_row else {}
    sid = sprint.get("id")
    hours_per_sp = sprint.get("hours_per_sp", 8.0)
    hours_per_day = sprint.get("hours_per_day", 8.0)
    week_offs = sprint.get("week_offs", "5,6")
    day_offs = sprint.get("day_offs", "")

    if start_date:
        base_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    else:
        today = date.today()
        base_date = today - timedelta(days=today.weekday())

    date_columns = []
    date_strs = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for i in range(days_count):
        curr_d = base_date + timedelta(days=i)
        d_str = curr_d.isoformat()
        date_strs.append(d_str)
        is_off, off_reason = is_date_off(curr_d, week_offs, day_offs)
        col_target = 0.0 if is_off else hours_per_day

        date_columns.append({
            "date": d_str,
            "day_name": day_names[curr_d.weekday()],
            "formatted": curr_d.strftime("%b %d"),
            "is_today": curr_d == date.today(),
            "is_weekend": curr_d.weekday() >= 5,
            "is_off_day": is_off,
            "off_day_reason": off_reason,
            "target_hours": col_target
        })

    # Fetch tasks
    t_query = "SELECT * FROM tasks"
    t_params = []
    if sid:
        t_query += " WHERE sprint_id = ?"
        t_params.append(sid)
    t_query += " ORDER BY id ASC"
    cursor.execute(t_query, t_params)
    task_rows = cursor.fetchall()

    cursor.execute("""
        SELECT ts.*, t.key, t.title, t.color
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.date BETWEEN ? AND ?
        ORDER BY ts.start_time ASC
    """, (date_strs[0], date_strs[-1]))
    slot_rows = cursor.fetchall()
    conn.close()

    slots_map = {}
    daily_totals = {d: 0.0 for d in date_strs}
    daily_slots_count = {d: 0 for d in date_strs}

    for sr in slot_rows:
        tid = sr["task_id"]
        d = sr["date"]
        dur = sr["duration_hours"]
        key = (tid, d)
        if key not in slots_map:
            slots_map[key] = []
        slots_map[key].append(dict(sr))
        if d in daily_totals:
            daily_totals[d] = round(daily_totals[d] + dur, 2)
            daily_slots_count[d] += 1

    matrix_rows = []
    grand_total_hours = 0.0
    total_budgeted_hours = 0.0

    for tr in task_rows:
        t_dict = dict(tr)
        sp = t_dict["story_points"] or 0.0
        budget = round(sp * hours_per_sp, 1)
        total_budgeted_hours += budget

        task_total_hours = 0.0
        cells = {}
        for d in date_strs:
            cell_slots = slots_map.get((t_dict["id"], d), [])
            cell_hours = round(sum(s["duration_hours"] for s in cell_slots), 2)
            task_total_hours = round(task_total_hours + cell_hours, 2)
            cells[d] = {
                "hours": cell_hours,
                "slots_count": len(cell_slots),
                "slots": cell_slots
            }

        grand_total_hours = round(grand_total_hours + task_total_hours, 2)
        pct = round((task_total_hours / budget * 100), 1) if budget > 0 else 0.0

        matrix_rows.append({
            "task": t_dict,
            "budgeted_hours": budget,
            "total_logged_hours": task_total_hours,
            "percent_spent": pct,
            "cells": cells
        })

    daily_aggregates = []
    for d in date_columns:
        d_str = d["date"]
        hours = daily_totals.get(d_str, 0.0)
        target = d["target_hours"]
        if d["is_off_day"]:
            status_tag = "off_day_worked" if hours > 0 else "off_day"
        else:
            status_tag = "target_met" if hours >= target else ("partial" if hours > 0 else "empty")

        daily_aggregates.append({
            **d,
            "total_hours": hours,
            "slots_count": daily_slots_count.get(d_str, 0),
            "status": status_tag
        })

    return {
        "sprint": sprint,
        "hours_per_sp": hours_per_sp,
        "hours_per_day": hours_per_day,
        "date_columns": date_columns,
        "rows": matrix_rows,
        "daily_aggregates": daily_aggregates,
        "grand_total_hours": grand_total_hours,
        "total_budgeted_hours": round(total_budgeted_hours, 1)
    }

# --- CSV EXPORT ENDPOINT ---

@app.get("/api/export/csv")
def export_timesheet_csv(sprint_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
        SELECT 
            ts.date,
            ts.start_time,
            ts.end_time,
            ts.duration_hours,
            ts.notes,
            t.key,
            t.title,
            t.status,
            t.story_points,
            s.name as sprint_name,
            s.hours_per_sp,
            s.hours_per_day
        FROM time_slots ts
        JOIN tasks t ON ts.task_id = t.id
        LEFT JOIN sprints s ON t.sprint_id = s.id
        WHERE 1=1
    """
    params = []
    if sprint_id:
        query += " AND t.sprint_id = ?"
        params.append(sprint_id)
    query += " ORDER BY ts.date DESC, ts.start_time ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Day of Week", "Task Key", "Task Title", "Story Points", 
        "Task Status", "Start Time", "End Time", "Duration (Hours)", 
        "Jira Format (d/h/m)", "Story Points Budget (Hours)", "Session Notes", "Sprint"
    ])

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for r in rows:
        d_obj = datetime.strptime(r["date"], "%Y-%m-%d").date()
        day_str = day_names[d_obj.weekday()]
        sp = r["story_points"] or 1.0
        h_per_sp = r["hours_per_sp"] or 8.0
        h_per_day = r["hours_per_day"] or 8.0
        budget = sp * h_per_sp
        jira_fmt = format_hours_to_jira_str(r["duration_hours"], hours_per_day=h_per_day)

        writer.writerow([
            r["date"],
            day_str,
            r["key"],
            r["title"],
            sp,
            r["status"],
            r["start_time"],
            r["end_time"],
            r["duration_hours"],
            jira_fmt,
            budget,
            r["notes"] or "",
            r["sprint_name"] or ""
        ])

    csv_data = output.getvalue()
    filename = f"ChronoJira_Timesheet_{date.today().isoformat()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

app.mount("/", StaticFiles(directory="static", html=True), name="static")
