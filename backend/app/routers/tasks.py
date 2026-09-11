from fastapi import APIRouter, HTTPException
from typing import Optional
from ..database import get_db_connection
from ..schemas.task import TaskCreate, TaskUpdate, SubtaskCreate
from ..services.duration_parser import parse_jira_time_str, format_hours_to_jira_str

router = APIRouter(tags=["Tasks"])

@router.get("/api/tasks")
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

        if item.get("allocated_hours") and item["allocated_hours"] > 0:
            budget = round(item["allocated_hours"], 1)
        else:
            budget = round(sp * hours_per_sp, 1)

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

@router.post("/api/tasks")
def create_task(task: TaskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Determine task key: custom or auto-generated
    if task.key and task.key.strip():
        task_key = task.key.strip().upper()
        cursor.execute("SELECT id FROM tasks WHERE key = ?", (task_key,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"Task key '{task_key}' is already in use.")
    else:
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

@router.post("/api/tasks/{parent_id}/subtasks")
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

    if subtask.key and subtask.key.strip():
        sub_key = subtask.key.strip().upper()
        cursor.execute("SELECT id FROM tasks WHERE key = ?", (sub_key,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"Subtask key '{sub_key}' is already in use.")
    else:
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
    """, (sub_key, subtask.title, "", sprint_id, parent_id, subtask.status, 0.5, allocated_hours, "medium", "#0071e3", subtask.assignee))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "key": sub_key, "message": "Subtask created successfully"}

@router.put("/api/subtasks/{subtask_id}/toggle")
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

@router.put("/api/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    if task.key and task.key.strip():
        clean_key = task.key.strip().upper()
        cursor.execute("SELECT id FROM tasks WHERE key = ? AND id != ?", (clean_key, task_id))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"Task key '{clean_key}' is already in use by another task.")
        task.key = clean_key

    # Get hours_per_day if allocated_time_str is provided
    if task.allocated_time_str and task.allocated_time_str.strip():
        cursor.execute("SELECT s.hours_per_day FROM tasks t LEFT JOIN sprints s ON t.sprint_id = s.id WHERE t.id = ?", (task_id,))
        s_row = cursor.fetchone()
        hours_per_day = s_row["hours_per_day"] if (s_row and s_row["hours_per_day"]) else 8.0
        try:
            parsed_hours = parse_jira_time_str(task.allocated_time_str, hours_per_day=hours_per_day)
            task.allocated_hours = parsed_hours
        except ValueError as e:
            conn.close()
            raise HTTPException(status_code=400, detail=str(e))

    fields = []
    values = []
    update_data = task.dict(exclude_unset=True)
    update_data.pop("allocated_time_str", None)

    for k, v in update_data.items():
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

@router.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted successfully"}
