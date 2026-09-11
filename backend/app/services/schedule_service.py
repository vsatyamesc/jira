from datetime import datetime
from typing import Optional, Dict, Any
from ..database import get_db_connection
from .duration_parser import parse_time_to_minutes, is_date_off

def get_day_schedule_data(date_str: str, sprint_id: Optional[int] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

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

    # Full 24-hour scale: 00:00 to 24:00 (0 to 1440 minutes)
    day_start = 0
    day_end = 24 * 60
    current_pointer = day_start

    free_blocks = []
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
                "duration_hours": round(gap_min / 60.0, 2),
                "is_core": (current_pointer >= 8 * 60 and s_start <= 19 * 60)
            })
        current_pointer = max(current_pointer, s_end)

    if current_pointer < day_end:
        gap_min = day_end - current_pointer
        start_hh = f"{current_pointer // 60:02d}:{current_pointer % 60:02d}"
        end_hh = f"{day_end // 60:02d}:{day_end % 60:02d}"
        free_blocks.append({
            "start_time": start_hh,
            "end_time": end_hh,
            "duration_hours": round(gap_min / 60.0, 2),
            "is_core": (current_pointer >= 8 * 60 and day_end <= 19 * 60)
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
        "free_blocks": free_blocks,
        "core_work_start": "08:00",
        "core_work_end": "19:00"
    }
