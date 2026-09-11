import os
import sys
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_tests():
    print("=== STARTING COMPREHENSIVE SUBTASK & TIME ROLLUP VERIFICATION ===")

    # Clean up any leftover test data
    from backend.app.database import get_db_connection
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM time_slots WHERE task_id IN (SELECT id FROM tasks WHERE key LIKE 'CORE-2%')")
    c.execute("DELETE FROM tasks WHERE key LIKE 'CORE-2%'")
    conn.commit()
    conn.close()
    sprint_res = client.post("/api/sprints", json={
        "name": "Sprint Subtask Verification",
        "goal": "Verify subtask keys and time rollup to parent",
        "start_date": "2026-09-14",
        "end_date": "2026-09-27",
        "hours_per_sp": 8.0,
        "hours_per_day": 8.0,
        "week_offs": "5,6",
        "day_offs": "",
        "status": "active"
    })
    assert sprint_res.status_code == 200, sprint_res.text
    sprint_id = sprint_res.json()["id"]
    print(f"[1] Created Sprint ID: {sprint_id}")

    # 2. Create parent task with custom ticket key
    parent_res = client.post("/api/tasks", json={
        "key": "CORE-200",
        "title": "Main Epic Feature",
        "sprint_id": sprint_id,
        "story_points": 3.0,
        "allocated_time_str": "16h",
        "priority": "high",
        "color": "#0071e3"
    })
    assert parent_res.status_code == 200, parent_res.text
    parent_data = parent_res.json()
    parent_id = parent_data["id"]
    assert parent_data["key"] == "CORE-200", f"Expected CORE-200, got {parent_data['key']}"
    print(f"[2] Created Parent Task: {parent_data['key']} (ID: {parent_id})")

    # 3. Create subtask 1 with custom ticket key
    sub1_res = client.post(f"/api/tasks/{parent_id}/subtasks", json={
        "key": "CORE-200-API",
        "title": "Build FastAPI endpoint",
        "allocated_time_str": "4h"
    })
    assert sub1_res.status_code == 200, sub1_res.text
    sub1_data = sub1_res.json()
    sub1_id = sub1_data["id"]
    assert sub1_data["key"] == "CORE-200-API", f"Expected CORE-200-API, got {sub1_data['key']}"
    print(f"[3] Created Subtask 1: {sub1_data['key']} (ID: {sub1_id})")

    # 4. Create subtask 2 with auto-generated ticket key
    sub2_res = client.post(f"/api/tasks/{parent_id}/subtasks", json={
        "title": "Build React UI Component",
        "allocated_time_str": "3h"
    })
    assert sub2_res.status_code == 200, sub2_res.text
    sub2_data = sub2_res.json()
    sub2_id = sub2_data["id"]
    assert sub2_data["key"] == "CORE-200-2", f"Expected CORE-200-2, got {sub2_data['key']}"
    print(f"[4] Created Subtask 2 (Auto-Key): {sub2_data['key']} (ID: {sub2_id})")

    # 5. Log time directly to subtask 1 (2 hours on 2026-09-15)
    t1_res = client.post("/api/time-slots", json={
        "task_id": sub1_id,
        "date": "2026-09-15",
        "start_time": "10:00",
        "end_time": "12:00",
        "notes": "Backend API routing for subtasks"
    })
    assert t1_res.status_code == 200, t1_res.text
    t1_id = t1_res.json()["id"]
    print(f"[5] Logged 2.0h directly to Subtask 1 (CORE-200-API, Slot ID: {t1_id})")

    # 6. Log time directly to subtask 2 (1.5 hours on 2026-09-15)
    t2_res = client.post("/api/time-slots", json={
        "task_id": sub2_id,
        "date": "2026-09-15",
        "start_time": "14:00",
        "end_time": "15:30",
        "notes": "React modal component implementation"
    })
    assert t2_res.status_code == 200, t2_res.text
    t2_id = t2_res.json()["id"]
    print(f"[6] Logged 1.5h directly to Subtask 2 (CORE-200-2, Slot ID: {t2_id})")

    # 7. Log time directly to parent task (1.0 hour on 2026-09-16)
    t3_res = client.post("/api/time-slots", json={
        "task_id": parent_id,
        "date": "2026-09-16",
        "start_time": "09:00",
        "end_time": "10:00",
        "notes": "Architecture review & integration sync"
    })
    assert t3_res.status_code == 200, t3_res.text
    t3_id = t3_res.json()["id"]
    print(f"[7] Logged 1.0h directly to Parent Task (CORE-200, Slot ID: {t3_id})")

    # 8. Check GET /api/tasks: verify individual subtask logged hours AND parent rollup
    tasks_res = client.get(f"/api/tasks?sprint_id={sprint_id}")
    assert tasks_res.status_code == 200, tasks_res.text
    tasks = tasks_res.json()
    parent_task = next(t for t in tasks if t["id"] == parent_id)

    # Subtask 1 verification
    st1 = next(s for s in parent_task["subtasks"] if s["id"] == sub1_id)
    assert st1["key"] == "CORE-200-API"
    assert st1["sub_logged_hours"] == 2.0, f"Expected 2.0, got {st1['sub_logged_hours']}"

    # Subtask 2 verification
    st2 = next(s for s in parent_task["subtasks"] if s["id"] == sub2_id)
    assert st2["key"] == "CORE-200-2"
    assert st2["sub_logged_hours"] == 1.5, f"Expected 1.5, got {st2['sub_logged_hours']}"

    # Parent Task Total Rolled-Up Hours: 2.0 (sub1) + 1.5 (sub2) + 1.0 (parent direct) = 4.5h
    assert parent_task["logged_hours"] == 4.5, f"Expected 4.5h total rolled up, got {parent_task['logged_hours']}"
    print(f"[8] Verified Task List: Parent logged_hours={parent_task['logged_hours']}h (Direct: 1.0h + Subtasks: 3.5h)")
    print(f"    Subtask 1 ({st1['key']}): {st1['sub_logged_hours']}h")
    print(f"    Subtask 2 ({st2['key']}): {st2['sub_logged_hours']}h")

    # 9. Check GET /api/timesheet/matrix: verify rollup in daily cells
    matrix_res = client.get(f"/api/timesheet/matrix?sprint_id={sprint_id}&view_mode=sprint")
    assert matrix_res.status_code == 200, matrix_res.text
    matrix_data = matrix_res.json()

    parent_matrix_row = next(r for r in matrix_data["rows"] if r["task"]["id"] == parent_id)
    assert parent_matrix_row["total_logged_hours"] == 4.5, f"Expected 4.5h in matrix, got {parent_matrix_row['total_logged_hours']}"

    # Verify 2026-09-15 cell rolled up both subtasks (2.0 + 1.5 = 3.5h)
    sep15_cell = parent_matrix_row["cells"]["2026-09-15"]
    assert sep15_cell["hours"] == 3.5, f"Expected 3.5h on 2026-09-15, got {sep15_cell['hours']}"
    assert sep15_cell["slots_count"] == 2, f"Expected 2 slots on 2026-09-15, got {sep15_cell['slots_count']}"
    assert any(s["key"] == "CORE-200-API" and s["is_subtask"] for s in sep15_cell["slots"])
    assert any(s["key"] == "CORE-200-2" and s["is_subtask"] for s in sep15_cell["slots"])

    # Verify 2026-09-16 cell has parent direct slot (1.0h)
    sep16_cell = parent_matrix_row["cells"]["2026-09-16"]
    assert sep16_cell["hours"] == 1.0, f"Expected 1.0h on 2026-09-16, got {sep16_cell['hours']}"
    assert sep16_cell["slots_count"] == 1
    assert any(s["key"] == "CORE-200" and not s["is_subtask"] for s in sep16_cell["slots"])

    print(f"[9] Verified Timesheet Matrix Rollup:")
    print(f"    Total Logged: {parent_matrix_row['total_logged_hours']}h")
    print(f"    2026-09-15 (Subtasks rollup): {sep15_cell['hours']}h ({sep15_cell['slots_count']} slots)")
    print(f"    2026-09-16 (Parent direct): {sep16_cell['hours']}h ({sep16_cell['slots_count']} slots)")

    # 10. Verify Full Time Matrix (view_mode="all")
    all_res = client.get("/api/timesheet/matrix?view_mode=all")
    assert all_res.status_code == 200
    all_data = all_res.json()
    assert any(r["task"]["id"] == parent_id for r in all_data["rows"])
    print("[10] Verified Full Time Matrix (view_mode='all') includes parent task with rolled up subtasks.")

    # 11. Cleanup test records
    client.delete(f"/api/time-slots/{t1_id}")
    client.delete(f"/api/time-slots/{t2_id}")
    client.delete(f"/api/time-slots/{t3_id}")
    client.delete(f"/api/tasks/{sub1_id}")
    client.delete(f"/api/tasks/{sub2_id}")
    client.delete(f"/api/tasks/{parent_id}")
    client.delete(f"/api/sprints/{sprint_id}")
    print("[11] Cleaned up test sprint, tasks, subtasks, and time slots successfully.")

    print("\n=== ALL SUBTASK TICKET NUMBER & TIME ROLLUP TESTS PASSED! ===")

if __name__ == "__main__":
    run_tests()
