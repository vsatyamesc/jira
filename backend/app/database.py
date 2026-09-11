import sqlite3
import os
from datetime import date, timedelta
from .config import DB_PATH

def get_db_connection():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Sprints table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sprints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            goal TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            hours_per_sp REAL DEFAULT 8.0,
            hours_per_day REAL DEFAULT 8.0,
            week_offs TEXT DEFAULT '5,6',
            day_offs TEXT DEFAULT '',
            status TEXT DEFAULT 'active'
        )
    """)

    # Migration for existing sprints table if columns are missing
    cursor.execute("PRAGMA table_info(sprints)")
    columns = [row["name"] for row in cursor.fetchall()]
    if "hours_per_day" not in columns:
        cursor.execute("ALTER TABLE sprints ADD COLUMN hours_per_day REAL DEFAULT 8.0")
    if "week_offs" not in columns:
        cursor.execute("ALTER TABLE sprints ADD COLUMN week_offs TEXT DEFAULT '5,6'")
    if "day_offs" not in columns:
        cursor.execute("ALTER TABLE sprints ADD COLUMN day_offs TEXT DEFAULT ''")

    # Tasks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            sprint_id INTEGER,
            parent_id INTEGER DEFAULT NULL,
            status TEXT DEFAULT 'todo',
            story_points REAL DEFAULT 1.0,
            allocated_hours REAL DEFAULT NULL,
            priority TEXT DEFAULT 'medium',
            color TEXT DEFAULT '#6366f1',
            assignee TEXT DEFAULT 'Me',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sprint_id) REFERENCES sprints (id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
    """)

    # Migration for tasks table
    cursor.execute("PRAGMA table_info(tasks)")
    task_columns = [row["name"] for row in cursor.fetchall()]
    if "parent_id" not in task_columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN parent_id INTEGER DEFAULT NULL")
    if "allocated_hours" not in task_columns:
        cursor.execute("ALTER TABLE tasks ADD COLUMN allocated_hours REAL DEFAULT NULL")

    # Time slots table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS time_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            duration_hours REAL NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
    """)

    conn.commit()

    # Check if we need to seed
    cursor.execute("SELECT COUNT(*) FROM sprints")
    # if cursor.fetchone()[0] == 0:
    #     seed_data(conn)

    conn.close()

def seed_data(conn):
    cursor = conn.cursor()
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())  # Monday of this week
    sprint_end = start_of_week + timedelta(days=13)  # 2-week sprint

    cursor.execute("""
        INSERT INTO sprints (name, goal, start_date, end_date, hours_per_sp, hours_per_day, week_offs, day_offs, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Sprint 1: Core MVP",
        "Visual time-slot scheduling, 8h/SP budgeting, and Excel timesheet matrix",
        start_of_week.isoformat(),
        sprint_end.isoformat(),
        8.0,
        8.0,
        "5,6",
        "",
        "active"
    ))
    sprint_id = cursor.lastrowid

    sample_tasks = [
        ("CJ-101", "Design visual time-slot grid component", "Build the day and week timeline showing occupied vs free time slots", sprint_id, "done", 1.0, "high", "#6366f1", "Alex"),
        ("CJ-102", "Implement Excel-style timesheet matrix", "Matrix view with tasks as rows and days as columns with daily aggregates", sprint_id, "in_progress", 2.0, "urgent", "#06b6d4", "Alex"),
        ("CJ-103", "Story Points to Hours budgeting engine", "Convert story points to hours (1 SP = 8h) and compute burn-up progress", sprint_id, "in_progress", 1.0, "high", "#10b981", "Alex"),
        ("CJ-104", "Time collision detection & warning alerts", "Detect overlapping booked slots and highlight conflicts visually", sprint_id, "todo", 1.0, "medium", "#f59e0b", "Alex"),
        ("CJ-105", "Export timesheet to Excel / CSV format", "Allow one-click CSV export of daily logged tasks and hours", sprint_id, "todo", 1.0, "low", "#ec4899", "Alex"),
        ("CJ-106", "Kanban drag-and-drop board integration", "Smooth column transition and quick time slot logging button", sprint_id, "done", 2.0, "medium", "#8b5cf6", "Alex"),
    ]

    cursor.executemany("""
        INSERT INTO tasks (key, title, description, sprint_id, status, story_points, priority, color, assignee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_tasks)

    cursor.execute("SELECT id, key FROM tasks WHERE sprint_id = ?", (sprint_id,))
    task_map = {row["key"]: row["id"] for row in cursor.fetchall()}

    yesterday = (today - timedelta(days=1)).isoformat()
    today_str = today.isoformat()
    two_days_ago = (today - timedelta(days=2)).isoformat()

    sample_slots = [
        (task_map["CJ-101"], two_days_ago, "09:00", "12:00", 3.0, "Wireframing time slot grid layouts"),
        (task_map["CJ-101"], two_days_ago, "13:30", "16:30", 3.0, "CSS grid alignment and 30-min intervals"),
        (task_map["CJ-106"], two_days_ago, "16:30", "18:30", 2.0, "Kanban board column cards setup"),
        (task_map["CJ-101"], yesterday, "09:30", "11:30", 2.0, "Finished visual time-slot component (8h logged for 1 SP!)"),
        (task_map["CJ-102"], yesterday, "12:30", "15:30", 3.0, "Building Excel timesheet table structure"),
        (task_map["CJ-106"], yesterday, "16:00", "19:00", 3.0, "Implemented HTML5 drag and drop cards"),
        (task_map["CJ-102"], today_str, "09:00", "12:30", 3.5, "Daily aggregate sum calculations"),
        (task_map["CJ-103"], today_str, "13:30", "16:30", 3.0, "Story points to hours ratio converter (1 SP = 8h)"),
    ]

    cursor.executemany("""
        INSERT INTO time_slots (task_id, date, start_time, end_time, duration_hours, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, sample_slots)

    conn.commit()
