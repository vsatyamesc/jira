# ChronoJira ⏱️
> A lightweight, visually-driven alternative to Jira built with **Python (FastAPI) + SQLite** and a modern web interface. Designed to solve Jira's visual time-slot blindness and story point hour budgeting.

---

## 💡 Key Problems Solved

### 1. Visual Time-Slot Scheduling (Occupied vs. Free Hours)
- **The Jira Problem**: Jira only records aggregate durations (e.g. "3 hours on Tuesday"), leaving you blind to *which time slots* of the day were actually spent.
- **The ChronoJira Solution**: An interactive **Daily & Weekly Visual Schedule Grid** (08:00 - 20:00 workday):
  - Proportional visual occupancy bar showing colored segments for each booked slot.
  - Hour-by-hour lanes with start/end chips, session notes, and direct click-to-book empty gaps.
  - Real-time **Collision & Overlap Warnings** that alert you if a slot collides with existing tasks on that day.

### 2. Story Points to Hours Conversion & Budgeting
- **The Jira Problem**: Story points in Jira are disconnected from daily time logs.
- **The ChronoJira Solution**: Configurable Story Point to Hours ratio (default **1 SP = 8.0 Hours**, adjustable):
  - Sprint capacity tracking (e.g. 8 SP = 64.0 Hours total budget).
  - Task cards display real-time burn-up progress meters (`4.5h / 8.0h (56%)`).
  - Sprint burn-up progress bar in the top navigation bar.

### 3. Excel-Style Timesheet Matrix (with Daily Aggregates)
- **The Personal Tracking Problem**: In an Excel sheet, you typically only have task rows and hours, with no visual time slots.
- **The ChronoJira Solution**: A dedicated **Timesheet Matrix View**:
  - Tasks as rows, days of the week (Monday through Sunday) as columns.
  - Cells display hours logged for that task on that day. Clicking any cell opens the session popover with exact timestamps (`09:00 - 12:30 (3.5h)`) and options to add/delete slots.
  - **Daily Aggregate Row**: Computes daily sum across all tasks, highlighting green when the 8-hour target is met!
  - **One-Click Export to Excel / CSV**: Download the complete timesheet into CSV format for Microsoft Excel.

### 4. Agile Kanban Board
- 4 clean columns: `To Do`, `In Progress`, `In Review`, `Done`.
- Drag-and-drop task status transitions.
- Quick `+ Log Slot` button on every card.

---

## 🚀 Getting Started

### Launching with Docker Compose (Recommended for Containerization)
```bash
docker compose up -d --build
```
The app will build the Vite React frontend and FastAPI backend into a single container and launch at:
```
http://localhost:8000
```
Database data is automatically persisted in `./data/chronojira.db`.

To stop the container:
```bash
docker compose down
```

### Launching Directly on Windows
```bash
run.bat
```
Or via command line:
```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 📁 Project Structure
 
```
jira-alt/
├── backend/               # Modular FastAPI Python backend (routers, schemas, services)
├── frontend/              # Modern Apple-inspired React SPA (Vite, CSS design tokens)
│   ├── dist/              # Production web bundle compiled by Vite
│   └── src/               # React components, modals, and time utilities
├── Dockerfile             # Multi-stage Docker build (Node.js builder -> Python runtime)
├── docker-compose.yml     # Container orchestration with volume persistence
├── requirements.txt       # Python backend dependencies
├── chronojira.db          # Persistent SQLite database
├── database.py            # SQLite connection, schema migrations, and helpers
├── main.py                # FastAPI server entry point (serves API and React SPA)
├── run.bat                # Windows launch script
└── test_api.py            # Automated API verification test suite
```
