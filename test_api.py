import urllib.request
import urllib.parse
import urllib.error
import json

base = 'http://127.0.0.1:8000'

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
    encoded_str = urllib.parse.quote(dur_str)
    req = urllib.request.urlopen(f"{base}/api/utils/parse-duration?duration={encoded_str}&hours_per_day={h_per_day}")
    data = json.loads(req.read())
    assert abs(data["hours"] - expected) < 0.01, f"Expected {expected}, got {data['hours']} for {dur_str}"
    print(f"  [OK] '{dur_str}' @ {h_per_day}h/day -> {data['hours']}h ({data['formatted']})")

print("[PASS] Regex duration conversions verified!")

# 2. Test Sprint Creation with 9h Workday, Custom Week-Offs & Day-Offs
print("\n[TEST 2] Testing Sprint Management (Creation with 9h workday & week-offs)...")
sprint_payload = json.dumps({
    "name": "Sprint 2: Real-Time Sync & Subtasks",
    "goal": "Deliver subtasks and 9h workday capacity",
    "start_date": "2026-09-14",
    "end_date": "2026-09-27",
    "hours_per_sp": 9.0,
    "hours_per_day": 9.0,
    "week_offs": "5,6", # Sat & Sun
    "day_offs": "2026-09-18", # Friday off
    "status": "planned"
}).encode('utf-8')

req = urllib.request.Request(f"{base}/api/sprints", data=sprint_payload, headers={'Content-Type': 'application/json'})
sprint_data = json.loads(urllib.request.urlopen(req).read())
sprint_2_id = sprint_data["id"]
print(f"[PASS] Created Sprint 2 (ID: {sprint_2_id})")

# 3. Test Task Creation with Explicit Allocated Time
print("\n[TEST 3] Creating Task with Allocated Time '1d 4h'...")
task_payload = json.dumps({
    "title": "Build subtask tree view and checklist",
    "description": "Interactive subtask toggle on Kanban cards",
    "sprint_id": sprint_2_id,
    "story_points": 2.0,
    "allocated_time_str": "1d 4h", # with 9h day -> 13.0 hours!
    "priority": "high",
    "assignee": "Alex"
}).encode('utf-8')

req = urllib.request.Request(f"{base}/api/tasks", data=task_payload, headers={'Content-Type': 'application/json'})
task_res = json.loads(urllib.request.urlopen(req).read())
parent_task_id = task_res["id"]
print(f"[PASS] Created Task {task_res['key']} (ID: {parent_task_id})")

# 4. Test Subtask Creation under Parent Task
print("\n[TEST 4] Creating Subtasks under Parent Task...")
subtask_1_payload = json.dumps({
    "title": "Subtask 1: Design subtask item markup",
    "allocated_time_str": "4h",
    "assignee": "Alex"
}).encode('utf-8')

req = urllib.request.Request(f"{base}/api/tasks/{parent_task_id}/subtasks", data=subtask_1_payload, headers={'Content-Type': 'application/json'})
sub_1 = json.loads(urllib.request.urlopen(req).read())
print(f"  ✓ Created Subtask: {sub_1['key']} (ID: {sub_1['id']})")

subtask_2_payload = json.dumps({
    "title": "Subtask 2: Add checkbox toggle handler",
    "allocated_time_str": "2h 30m",
    "assignee": "Alex"
}).encode('utf-8')

req = urllib.request.Request(f"{base}/api/tasks/{parent_task_id}/subtasks", data=subtask_2_payload, headers={'Content-Type': 'application/json'})
sub_2 = json.loads(urllib.request.urlopen(req).read())
print(f"  ✓ Created Subtask: {sub_2['key']} (ID: {sub_2['id']})")

# 5. Toggle Subtask Status
print("\n[TEST 5] Toggling Subtask Status...")
req = urllib.request.Request(f"{base}/api/subtasks/{sub_1['id']}/toggle", method='PUT')
toggle_res = json.loads(urllib.request.urlopen(req).read())
assert toggle_res["status"] == "done", f"Expected 'done', got {toggle_res['status']}"
print(f"  ✓ Subtask {sub_1['key']} toggled to: {toggle_res['status']}")

# 6. Verify Parent Task reflects Subtasks count and allocated hours
print("\n[TEST 6] Verifying Task List with Nested Subtasks...")
req = urllib.request.urlopen(f"{base}/api/tasks?sprint_id={sprint_2_id}")
tasks_s2 = json.loads(req.read())
target_task = next(t for t in tasks_s2 if t["id"] == parent_task_id)
assert target_task["subtasks_count"] == 2, f"Expected 2 subtasks, got {target_task['subtasks_count']}"
assert target_task["subtasks_done_count"] == 1, f"Expected 1 done subtask, got {target_task['subtasks_done_count']}"
assert target_task["budgeted_hours"] == 13.0, f"Expected 13.0h allocated (1d=9h + 4h), got {target_task['budgeted_hours']}"
print(f"[PASS] Parent task {target_task['key']}: Allocated={target_task['budgeted_hours']}h ({target_task['allocated_jira_str']}), Subtasks: {target_task['subtasks_done_count']}/{target_task['subtasks_count']} completed.")

# 7. Test Week-Off and Day-Off / Holiday Schedule Detection
print("\n[TEST 7] Testing Week-Off & Holiday Recognition...")
# Saturday check
req = urllib.request.urlopen(f"{base}/api/schedule/day?date=2026-09-19&sprint_id={sprint_2_id}")
sat_data = json.loads(req.read())
assert sat_data["is_off_day"] == True
assert sat_data["target_day_hours"] == 0.0
print(f"  ✓ Saturday: is_off_day={sat_data['is_off_day']}, Reason='{sat_data['off_day_reason']}', Target={sat_data['target_day_hours']}h")

# Friday holiday check (2026-09-18 configured in day_offs)
req = urllib.request.urlopen(f"{base}/api/schedule/day?date=2026-09-18&sprint_id={sprint_2_id}")
fri_data = json.loads(req.read())
assert fri_data["is_off_day"] == True
assert fri_data["target_day_hours"] == 0.0
print(f"  ✓ Friday Holiday: is_off_day={fri_data['is_off_day']}, Reason='{fri_data['off_day_reason']}', Target={fri_data['target_day_hours']}h")

# 8. Clean up Sprint 2 test task
urllib.request.urlopen(urllib.request.Request(f"{base}/api/tasks/{parent_task_id}", method='DELETE'))
print("\n[PASS] Cleaned up temporary test task")

print("\n=== ALL V2 VERIFICATION TESTS PASSED SUCCESSFULLY! ===")
