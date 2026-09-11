import io
import csv
from datetime import date, datetime
from typing import Optional, Tuple
from ..database import get_db_connection
from .duration_parser import format_hours_to_jira_str

def generate_timesheet_csv(sprint_id: Optional[int] = None) -> Tuple[str, str]:
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

    filename = f"ChronoJira_Timesheet_{date.today().isoformat()}.csv"
    return output.getvalue(), filename
