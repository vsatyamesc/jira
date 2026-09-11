from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

print("=== RUNNING FULL CHRONOJIRA V2 VERIFICATION SUITE ===")

# 1. Test Regex Duration Parser
print("\n[TEST 1] Testing Regex Duration Parser API...")
test_cases = [
    ("1d", 8.0, 8.0),
    ("1d", 9.0, 9.0),
    ("1d 2h", 8.0, 10.0),
    ("1d 2h", 9.0, 11.0),
    ("30m", 8.0, 0.5),
    ("45m", 8.0, 0.75),
    ("1w", 8.0, 40.0), # 5 days * 8h
    ("1w 2d 3h 30m", 8.0, 59.5) # 40 + 16 + 3.5
]

for dur_str, h_per_day, expected in test_cases:
    res = client.get(f"/api/utils/parse-duration?duration={dur_str}&hours_per_day={h_per_day}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert abs(data["hours"] - expected) < 0.01, f"Expected {expected}, got {data['hours']} for {dur_str}"
    print(f"  [OK] '{dur_str}' @ {h_per_day}h/day -> {data['hours']}h ({data['formatted']})")

print("[PASS] Regex duration conversions verified!")

# 2. Test Sprint Creation with 9h Workday, Custom Week-Offs & Day-Offs
print("\n[TEST 2] Testing Sprint Management (Creation with 9h workday & week-offs)...")
sprint_res = client.post("/api/sprints", json={
    "name": "Sprint 2: Real-Time Sync & Subtasks",
    "goal": "Deliver subtasks and 9h workday capacity",
    "start_date": "2026-09-14",
    "end_date": "2026-09-27",
    "hours_per_sp": 9.0,
    "hours_per_day": 9.0,
    "week_offs": "5,6", # Sat & Sun
    "day_offs": "2026-09-18", # Friday off
    "status": "planned"
})
assert sprint_res.status_code == 200, sprint_res.text
sprint_data = sprint_res.json()
sprint_2_id = sprint_data["id"]
print(f"[PASS] Created Sprint 2 (ID: {sprint_2_id})")

# 3. Test Task Creation with Custom Ticket Key & Explicit Allocated Time
print("\n[TEST 3] Creating Task with Custom Key 'PROJ-101' and Allocated Time '1d 4h'...")
task_res = client.post("/api/tasks", json={
    "key": "PROJ-101",
    "title": "Build subtask tree view and checklist",
    "description": "Interactive subtask toggle on Kanban cards",
    "sprint_id": sprint_2_id,
    "story_points": 2.0,
    "allocated_time_str": "1d 4h", # with 9h day -> 13.0 hours!
    "priority": "high",
    "assignee": "Alex"
})
assert task_res.status_code == 200, task_res.text
task_data = task_res.json()
parent_task_id = task_data["id"]
assert task_data["key"] == "PROJ-101"
print(f"[PASS] Created Task {task_data['key']} (ID: {parent_task_id})")

# 4. Test Subtask Creation under Parent Task with Custom Key & Auto Key
print("\n[TEST 4] Creating Subtasks under Parent Task...")
sub_1_res = client.post(f"/api/tasks/{parent_task_id}/subtasks", json={
    "key": "PROJ-101-UI",
    "title": "Subtask 1: Design subtask item markup",
    "allocated_time_str": "4h",
    "assignee": "Alex"
})
assert sub_1_res.status_code == 200, sub_1_res.text
sub_1 = sub_1_res.json()
assert sub_1["key"] == "PROJ-101-UI"
print(f"  [OK] Created Subtask: {sub_1['key']} (ID: {sub_1['id']})")

sub_2_res = client.post(f"/api/tasks/{parent_task_id}/subtasks", json={
    "title": "Subtask 2: Add checkbox toggle handler",
    "allocated_time_str": "2h 30m",
    "assignee": "Alex"
})
assert sub_2_res.status_code == 200, sub_2_res.text
sub_2 = sub_2_res.json()
assert sub_2["key"] == "PROJ-101-2"
print(f"  [OK] Created Subtask: {sub_2['key']} (ID: {sub_2['id']})")

# 5. Toggle Subtask Status
print("\n[TEST 5] Toggling Subtask Status...")
toggle_res = client.put(f"/api/subtasks/{sub_1['id']}/toggle").json()
assert toggle_res["status"] == "done", f"Expected 'done', got {toggle_res['status']}"
print(f"  [OK] Subtask {sub_1['key']} toggled to: {toggle_res['status']}")

# 6. Test Time Logging directly to Subtask and verify Rollup to Parent
print("\n[TEST 6] Logging Time to Subtask & Verifying Parent Rollup...")
slot_res = client.post("/api/time-slots", json={
    "task_id": sub_1["id"],
    "date": "2026-09-15",
    "start_time": "10:00",
    "end_time": "12:30",
    "notes": "Building subtask tree markup"
})
assert slot_res.status_code == 200, slot_res.text
sub_slot_id = slot_res.json()["id"]
assert slot_res.json()["duration_hours"] == 2.5
print(f"  [OK] Logged 2.5h to subtask {sub_1['key']}")

# Check task list
tasks_res = client.get(f"/api/tasks?sprint_id={sprint_2_id}").json()
target_task = next(t for t in tasks_res if t["id"] == parent_task_id)
assert target_task["subtasks_count"] == 2
assert target_task["subtasks_done_count"] == 1
assert target_task["budgeted_hours"] == 13.0
assert target_task["logged_hours"] == 2.5, f"Expected 2.5h rolled up to parent, got {target_task['logged_hours']}"
print(f"[PASS] Parent task {target_task['key']}: Logged={target_task['logged_hours']}h (Subtask rolled up!), Budgeted={target_task['budgeted_hours']}h")

# Check Timesheet Matrix
matrix_res = client.get(f"/api/timesheet?sprint_id={sprint_2_id}&view_mode=sprint").json()
matrix_row = next(r for r in matrix_res["rows"] if r["task"]["id"] == parent_task_id)
assert matrix_row["total_logged_hours"] == 2.5
assert matrix_row["cells"]["2026-09-15"]["hours"] == 2.5
assert matrix_row["cells"]["2026-09-15"]["slots"][0]["is_subtask"] == True
assert matrix_row["cells"]["2026-09-15"]["slots"][0]["key"] == "PROJ-101-UI"
print(f"[PASS] Timesheet Matrix correctly aggregated 2.5h under parent {target_task['key']} with subtask metadata.")

# 7. Test Week-Off and Day-Off / Holiday Schedule Detection
print("\n[TEST 7] Testing Week-Off & Holiday Recognition...")
# Saturday check
sat_data = client.get(f"/api/schedule/day?date=2026-09-19&sprint_id={sprint_2_id}").json()
assert sat_data["is_off_day"] == True
assert sat_data["target_day_hours"] == 0.0
print(f"  [OK] Saturday: is_off_day={sat_data['is_off_day']}, Reason='{sat_data['off_day_reason']}', Target={sat_data['target_day_hours']}h")

# Friday holiday check (2026-09-18 configured in day_offs)
fri_data = client.get(f"/api/schedule/day?date=2026-09-18&sprint_id={sprint_2_id}").json()
assert fri_data["is_off_day"] == True
assert fri_data["target_day_hours"] == 0.0
print(f"  [OK] Friday Holiday: is_off_day={fri_data['is_off_day']}, Reason='{fri_data['off_day_reason']}', Target={fri_data['target_day_hours']}h")

# 8. Clean up Sprint 2 test task and time slot
client.delete(f"/api/time-slots/{sub_slot_id}")
client.delete(f"/api/tasks/{sub_1['id']}")
client.delete(f"/api/tasks/{sub_2['id']}")
client.delete(f"/api/tasks/{parent_task_id}")
client.delete(f"/api/sprints/{sprint_2_id}")
print("\n[PASS] Cleaned up temporary test data")

print("\n=== ALL V2 VERIFICATION TESTS PASSED SUCCESSFULLY! ===")
