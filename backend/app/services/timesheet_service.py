from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any
from ..database import get_db_connection
from .duration_parser import is_date_off

def get_timesheet_matrix_data(
    sprint_id: Optional[int] = None,
    start_date: Optional[str] = None,
    days_count: int = 7,
    view_mode: str = "sprint"
) -> Dict[str, Any]:
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

    # Date range calculations
    if view_mode == "sprint" and sprint.get("start_date") and sprint.get("end_date"):
        base_date = datetime.strptime(sprint["start_date"], "%Y-%m-%d").date()
        end_d = datetime.strptime(sprint["end_date"], "%Y-%m-%d").date()
        days_count = max(1, (end_d - base_date).days + 1)
    elif start_date:
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

    # Fetch top-level parent tasks (subtasks roll up directly into them)
    if view_mode == "all":
        t_query = """
            SELECT t.*, s.name as sprint_name, s.hours_per_sp as sprint_hours_per_sp
            FROM tasks t
            LEFT JOIN sprints s ON t.sprint_id = s.id
            WHERE t.parent_id IS NULL
            ORDER BY t.sprint_id DESC, t.id ASC
        """
        cursor.execute(t_query)
        task_rows = cursor.fetchall()
    else:
        t_query = """
            SELECT t.*, s.name as sprint_name, s.hours_per_sp as sprint_hours_per_sp
            FROM tasks t
            LEFT JOIN sprints s ON t.sprint_id = s.id
            WHERE t.parent_id IS NULL
        """
        t_params = []
        if sid:
            t_query += " AND t.sprint_id = ?"
            t_params.append(sid)
        t_query += " ORDER BY t.id ASC"
        cursor.execute(t_query, t_params)
        task_rows = cursor.fetchall()

    # Map all subtasks for each parent task
    parent_subtask_map = {}
    subtask_to_parent_map = {}
    cursor.execute("SELECT id, parent_id, key, title FROM tasks WHERE parent_id IS NOT NULL")
    for sub in cursor.fetchall():
        pid = sub["parent_id"]
        if pid not in parent_subtask_map:
            parent_subtask_map[pid] = []
        parent_subtask_map[pid].append(dict(sub))
        subtask_to_parent_map[sub["id"]] = pid

    # Fetch all time slots in date range
    if date_strs:
        cursor.execute("""
            SELECT ts.*, t.key, t.title, t.color, t.parent_id
            FROM time_slots ts
            JOIN tasks t ON ts.task_id = t.id
            WHERE ts.date BETWEEN ? AND ?
            ORDER BY ts.start_time ASC
        """, (date_strs[0], date_strs[-1]))
        slot_rows = cursor.fetchall()
    else:
        slot_rows = []
    conn.close()

    # Map time slots to their effective parent task ID
    slots_map = {}
    daily_totals = {d: 0.0 for d in date_strs}
    daily_slots_count = {d: 0 for d in date_strs}

    for sr in slot_rows:
        s_dict = dict(sr)
        tid = s_dict["task_id"]
        d = s_dict["date"]
        dur = s_dict["duration_hours"]

        # If this slot belongs to a subtask, roll it up to the parent task ID!
        effective_task_id = s_dict["parent_id"] if s_dict.get("parent_id") else tid
        s_dict["is_subtask"] = bool(s_dict.get("parent_id"))

        key = (effective_task_id, d)
        if key not in slots_map:
            slots_map[key] = []
        slots_map[key].append(s_dict)

        if d in daily_totals:
            daily_totals[d] = round(daily_totals[d] + dur, 2)
            daily_slots_count[d] += 1

    matrix_rows = []
    grand_total_hours = 0.0
    total_budgeted_hours = 0.0

    for tr in task_rows:
        t_dict = dict(tr)
        sp = t_dict.get("story_points") or 0.0
        task_h_per_sp = t_dict.get("sprint_hours_per_sp") or hours_per_sp
        if t_dict.get("allocated_hours") and t_dict["allocated_hours"] > 0:
            budget = round(t_dict["allocated_hours"], 1)
        else:
            budget = round(sp * task_h_per_sp, 1)
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
            "cells": cells,
            "subtasks": parent_subtask_map.get(t_dict["id"], [])
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
        "view_mode": view_mode,
        "date_columns": date_columns,
        "rows": matrix_rows,
        "daily_aggregates": daily_aggregates,
        "grand_total_hours": grand_total_hours,
        "total_budgeted_hours": round(total_budgeted_hours, 1)
    }
