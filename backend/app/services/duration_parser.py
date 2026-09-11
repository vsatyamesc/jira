import re
from datetime import date
from typing import Tuple

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

def is_date_off(d: date, week_offs_str: str, day_offs_str: str) -> Tuple[bool, str]:
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
