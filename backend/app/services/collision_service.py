from typing import Optional, List, Dict, Any
from ..database import get_db_connection
from .duration_parser import parse_time_to_minutes

def check_overlap(date_str: str, start_str: str, end_str: str, exclude_id: Optional[int] = None) -> List[Dict[str, Any]]:
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
