// ChronoJira API Client

const API = {
  baseUrl: '',

  async request(endpoint, options = {}) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errData = await res.json();
        if (errData.detail) errMessage = errData.detail;
      } catch (_) {}
      const error = new Error(errMessage);
      error.status = res.status;
      throw error;
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  },

  // Sprints
  getSprints() {
    return this.request('/api/sprints');
  },
  getActiveSprint(sprintId) {
    const q = sprintId ? `?sprint_id=${sprintId}` : '';
    return this.request(`/api/sprints/active${q}`);
  },
  createSprint(data) {
    return this.request('/api/sprints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateSprint(id, data) {
    return this.request(`/api/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  closeSprint(id, data = {}) {
    return this.request(`/api/sprints/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Tasks
  getTasks(sprintId, allTasks = false) {
    let params = new URLSearchParams();
    if (sprintId) params.append('sprint_id', sprintId);
    if (allTasks) params.append('all_tasks', 'true');
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/tasks${q}`);
  },
  createTask(data) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateTask(id, data) {
    return this.request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteTask(id) {
    return this.request(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },
  createSubtask(parentId, data) {
    return this.request(`/api/tasks/${parentId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  toggleSubtask(subtaskId) {
    return this.request(`/api/subtasks/${subtaskId}/toggle`, {
      method: 'PUT',
    });
  },

  // Time Slots
  getTimeSlots(dateStr, taskId) {
    let params = new URLSearchParams();
    if (dateStr) params.append('date', dateStr);
    if (taskId) params.append('task_id', taskId);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/time-slots${q}`);
  },
  createTimeSlot(data) {
    return this.request('/api/time-slots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteTimeSlot(id) {
    return this.request(`/api/time-slots/${id}`, {
      method: 'DELETE',
    });
  },

  // Schedule
  getDaySchedule(dateStr, sprintId) {
    const q = sprintId ? `&sprint_id=${sprintId}` : '';
    return this.request(`/api/schedule/day?date=${dateStr}${q}`);
  },

  // Timesheet
  getTimesheet(sprintId, startDate, daysCount = 7, viewMode = 'week') {
    let params = new URLSearchParams();
    if (sprintId) params.append('sprint_id', sprintId);
    if (startDate) params.append('start_date', startDate);
    params.append('days_count', daysCount);
    params.append('view_mode', viewMode);
    return this.request(`/api/timesheet?${params.toString()}`);
  },

  // Utilities
  parseDuration(durationStr, hoursPerDay, sprintId) {
    let params = new URLSearchParams();
    params.append('duration', durationStr);
    if (hoursPerDay) params.append('hours_per_day', hoursPerDay);
    if (sprintId) params.append('sprint_id', sprintId);
    return this.request(`/api/utils/parse-duration?${params.toString()}`);
  },

  getExportCsvUrl(sprintId) {
    return `/api/export/csv${sprintId ? `?sprint_id=${sprintId}` : ''}`;
  },
};

export default API;
