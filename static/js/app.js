// Main Application Controller for ChronoJira (v2.0)

const App = {
  activeSprint: null,
  sprints: [],
  tasks: [],
  currentView: 'kanban',

  async init() {
    this.setupViewTabs();
    this.setupModals();
    await this.reloadAll();
    Kanban.init();
    Schedule.init();
    Timesheet.init();
  },

  async reloadAll(targetSprintId = null) {
    try {
      this.sprints = await API.getSprints();

      if (targetSprintId) {
        this.activeSprint = await API.getActiveSprint(targetSprintId);
      } else if (!this.activeSprint) {
        this.activeSprint = await API.getActiveSprint();
      } else {
        // Refresh currently selected sprint
        this.activeSprint = await API.getActiveSprint(this.activeSprint.id);
      }

      this.tasks = await API.getTasks(this.activeSprint.id);

      this.updateSprintHeader();
      this.renderSprintSelectorDropdown();
      
      // Re-render current active view
      if (this.currentView === 'kanban') {
        Kanban.render(this.tasks);
      } else if (this.currentView === 'schedule') {
        Schedule.render();
      } else if (this.currentView === 'timesheet') {
        Timesheet.render();
      } else if (this.currentView === 'analytics') {
        Analytics.render(this.tasks, this.activeSprint);
      }

      this.populateTaskDropdowns();
    } catch (err) {
      console.error('Initialization error:', err);
      this.showToast(`Failed to load data: ${err.message}`, 'error');
    }
  },

  // --- SPRINT MANAGEMENT ---

  renderSprintSelectorDropdown() {
    const select = document.getElementById('sprint-dropdown-select');
    if (!select) return;

    select.innerHTML = '';
    this.sprints.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const statusBadge = s.status === 'active' ? '⚡ Active' : (s.status === 'closed' ? '🔒 Closed' : '📅 Planned');
      opt.textContent = `${s.name} [${statusBadge}]`;
      if (this.activeSprint && s.id === this.activeSprint.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  },

  async onSprintDropdownChange(sprintId) {
    if (!sprintId) return;
    await this.reloadAll(parseInt(sprintId, 10));
    this.showToast(`Switched to sprint: ${this.activeSprint.name}`, 'success');
  },

  updateSprintHeader() {
    if (!this.activeSprint) return;
    const s = this.activeSprint;

    const sprintDates = document.getElementById('header-sprint-dates');
    const statSp = document.getElementById('stat-total-sp');
    const statRatio = document.getElementById('stat-ratio-label');
    const statDayHours = document.getElementById('stat-day-hours-label');
    const statBudget = document.getElementById('stat-budget-hours');
    const statLogged = document.getElementById('stat-logged-hours');
    const statRemaining = document.getElementById('stat-remaining-hours');
    const progressFill = document.getElementById('header-progress-fill');
    const progressPercent = document.getElementById('header-progress-percent');
    const btnCloseSprint = document.getElementById('btn-header-close-sprint');

    if (sprintDates) sprintDates.textContent = `${s.start_date} – ${s.end_date}`;
    if (statSp) statSp.textContent = `${s.total_story_points} SP`;
    if (statRatio) statRatio.textContent = `1 SP = ${s.hours_per_sp}h`;
    if (statDayHours) statDayHours.textContent = `1d = ${s.hours_per_day || 8.0}h`;
    if (statBudget) statBudget.textContent = `${s.budgeted_hours}h`;
    if (statLogged) statLogged.textContent = `${s.logged_hours}h`;
    if (statRemaining) statRemaining.textContent = `${s.remaining_hours}h`;
    if (progressFill) progressFill.style.width = `${s.progress_percentage}%`;
    if (progressPercent) progressPercent.textContent = `${s.progress_percentage}%`;

    if (btnCloseSprint) {
      btnCloseSprint.style.display = s.status === 'active' ? 'inline-flex' : 'none';
    }
  },

  openSprintModal(isEdit = false) {
    const modal = document.getElementById('modal-sprint-manage');
    const title = document.getElementById('sprint-modal-title');
    const form = document.getElementById('form-sprint-manage');
    form.reset();

    const nameInput = document.getElementById('sprint-name-input');
    const goalInput = document.getElementById('sprint-goal-input');
    const startInput = document.getElementById('sprint-start-input');
    const endInput = document.getElementById('sprint-end-input');
    const spRatioInput = document.getElementById('sprint-sp-ratio-input');
    const dayHoursInput = document.getElementById('sprint-day-hours-input');
    const dayOffsInput = document.getElementById('sprint-day-offs-input');
    const statusSelect = document.getElementById('sprint-status-select');
    const sprintIdHidden = document.getElementById('sprint-id-hidden');

    if (isEdit && this.activeSprint) {
      const s = this.activeSprint;
      title.textContent = '⚙️ Edit Sprint Settings';
      sprintIdHidden.value = s.id;
      nameInput.value = s.name;
      goalInput.value = s.goal || '';
      startInput.value = s.start_date;
      endInput.value = s.end_date;
      spRatioInput.value = s.hours_per_sp || 8.0;
      dayHoursInput.value = s.hours_per_day || 8.0;
      dayOffsInput.value = s.day_offs || '';
      statusSelect.value = s.status || 'active';

      // Set week-offs checkboxes
      const weekOffs = (s.week_offs || '5,6').split(',').map(x => x.trim());
      for (let i = 0; i <= 6; i++) {
        const cb = document.getElementById(`week-off-${i}`);
        if (cb) cb.checked = weekOffs.includes(i.toString());
      }
    } else {
      title.textContent = '🚀 Create New Sprint';
      sprintIdHidden.value = '';
      const today = new Date();
      startInput.value = this.formatDateIso(today);
      const endD = new Date(today);
      endD.setDate(today.getDate() + 13);
      endInput.value = this.formatDateIso(endD);
      spRatioInput.value = '8.0';
      dayHoursInput.value = '8.0';
      statusSelect.value = 'active';

      // Default Saturday (5) & Sunday (6) checked
      for (let i = 0; i <= 6; i++) {
        const cb = document.getElementById(`week-off-${i}`);
        if (cb) cb.checked = (i === 5 || i === 6);
      }
    }

    if (modal) modal.classList.add('open');
  },

  closeSprintModal() {
    const modal = document.getElementById('modal-sprint-manage');
    if (modal) modal.classList.remove('open');
  },

  async submitSprintForm() {
    const sprintIdHidden = document.getElementById('sprint-id-hidden').value;
    const name = document.getElementById('sprint-name-input').value.trim();
    const goal = document.getElementById('sprint-goal-input').value.trim();
    const startDate = document.getElementById('sprint-start-input').value;
    const endDate = document.getElementById('sprint-end-input').value;
    const hoursPerSp = parseFloat(document.getElementById('sprint-sp-ratio-input').value) || 8.0;
    const hoursPerDay = parseFloat(document.getElementById('sprint-day-hours-input').value) || 8.0;
    const dayOffs = document.getElementById('sprint-day-offs-input').value.trim();
    const status = document.getElementById('sprint-status-select').value;

    if (!name || !startDate || !endDate) {
      this.showToast('Please fill in sprint name, start and end dates', 'error');
      return;
    }

    // Collect week-offs
    const selectedWeekOffs = [];
    for (let i = 0; i <= 6; i++) {
      const cb = document.getElementById(`week-off-${i}`);
      if (cb && cb.checked) selectedWeekOffs.push(i);
    }
    const weekOffsStr = selectedWeekOffs.join(',');

    try {
      if (sprintIdHidden) {
        // Update existing sprint
        await API.updateSprint(parseInt(sprintIdHidden, 10), {
          name,
          goal,
          start_date: startDate,
          end_date: endDate,
          hours_per_sp: hoursPerSp,
          hours_per_day: hoursPerDay,
          week_offs: weekOffsStr,
          day_offs: dayOffs,
          status
        });
        this.showToast('Sprint updated successfully!', 'success');
        this.closeSprintModal();
        await this.reloadAll(parseInt(sprintIdHidden, 10));
      } else {
        // Create new sprint
        const res = await API.createSprint({
          name,
          goal,
          start_date: startDate,
          end_date: endDate,
          hours_per_sp: hoursPerSp,
          hours_per_day: hoursPerDay,
          week_offs: weekOffsStr,
          day_offs: dayOffs,
          status
        });
        this.showToast(`Created new sprint: ${name}`, 'success');
        this.closeSprintModal();
        await this.reloadAll(res.id);
      }
    } catch (err) {
      this.showToast(`Error saving sprint: ${err.message}`, 'error');
    }
  },

  openCloseSprintModal() {
    if (!this.activeSprint) return;
    const modal = document.getElementById('modal-close-sprint');
    const summarySpan = document.getElementById('close-sprint-summary');
    const moveSelect = document.getElementById('close-move-tasks-select');

    const doneCount = this.tasks.filter(t => t.status === 'done').length;
    const incompleteCount = this.tasks.length - doneCount;

    if (summarySpan) {
      summarySpan.innerHTML = `<strong>${doneCount}</strong> completed task(s), <strong style="color: var(--accent-amber);">${incompleteCount}</strong> incomplete task(s).`;
    }

    if (moveSelect) {
      moveSelect.innerHTML = '<option value="">Backlog (No Sprint)</option>';
      this.sprints
        .filter(s => s.id !== this.activeSprint.id && s.status !== 'closed')
        .forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.name} (${s.status})`;
          moveSelect.appendChild(opt);
        });
    }

    if (modal) modal.classList.add('open');
  },

  closeCloseSprintModal() {
    const modal = document.getElementById('modal-close-sprint');
    if (modal) modal.classList.remove('open');
  },

  async submitCloseSprint() {
    if (!this.activeSprint) return;
    const moveSelect = document.getElementById('close-move-tasks-select');
    const targetSprintId = moveSelect && moveSelect.value ? parseInt(moveSelect.value, 10) : null;

    try {
      await API.closeSprint(this.activeSprint.id, {
        move_incomplete_to: targetSprintId
      });
      this.showToast(`Sprint "${this.activeSprint.name}" closed!`, 'success');
      this.closeCloseSprintModal();
      this.activeSprint = null;
      await this.reloadAll();
    } catch (err) {
      this.showToast(`Failed to close sprint: ${err.message}`, 'error');
    }
  },

  // --- REGEX TIME PARSER (Client-Side) ---

  parseDuration(durStr) {
    if (!durStr) return null;
    const s = durStr.trim();
    if (!s) return null;

    const hoursPerDay = this.activeSprint ? (this.activeSprint.hours_per_day || 8.0) : 8.0;
    const workingDays = 5;

    // Plain decimal or integer (e.g. "2" or "2.5")
    if (/^(\d+(\.\d+)?)$/.test(s)) {
      return parseFloat(s);
    }

    // Colon format (e.g. "02:30")
    if (/^(\d{1,2}):(\d{2})$/.test(s)) {
      const [h, m] = s.split(':').map(Number);
      return roundTwo(h + m / 60.0);
    }

    // Jira format regex: weeks, days, hours, minutes
    const regex = /^(?:(\d+(?:\.\d+)?)\s*w)?\s*(?:(\d+(?:\.\d+)?)\s*d)?\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?$/i;
    const match = s.match(regex);
    if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) {
      return null;
    }

    const w = parseFloat(match[1] || 0);
    const d = parseFloat(match[2] || 0);
    const h = parseFloat(match[3] || 0);
    const m = parseFloat(match[4] || 0);

    const totalHours = (w * workingDays * hoursPerDay) + (d * hoursPerDay) + h + (m / 60.0);
    return roundTwo(totalHours);
  },

  formatJiraDuration(hours) {
    if (!hours || hours <= 0) return '0m';
    const hoursPerDay = this.activeSprint ? (this.activeSprint.hours_per_day || 8.0) : 8.0;
    const totalMinutes = Math.round(hours * 60);
    const dayMinutes = Math.round(hoursPerDay * 60);

    const d = Math.floor(totalMinutes / dayMinutes);
    const rem = totalMinutes % dayMinutes;
    const h = Math.floor(rem / 60);
    const m = rem % 60;

    const parts = [];
    if (d > 0) parts.append ? parts.append(`${d}d`) : parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.length > 0 ? parts.join(' ') : `${hours}h`;
  },

  // --- VIEW TABS & MODALS ---

  setupViewTabs() {
    const tabs = document.querySelectorAll('.view-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const view = tab.getAttribute('data-view');
        this.switchView(view);
      });
    });
  },

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`panel-${view}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    if (view === 'kanban') {
      Kanban.render(this.tasks);
    } else if (view === 'schedule') {
      Schedule.render();
    } else if (view === 'timesheet') {
      Timesheet.render();
    } else if (view === 'analytics') {
      Analytics.render(this.tasks, this.activeSprint);
    }
  },

  populateTaskDropdowns() {
    const select = document.getElementById('slot-task-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Choose Work Item / Task --</option>';
    this.tasks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `[${t.key}] ${t.title} (${t.story_points} SP, ${t.logged_hours}h / ${t.budgeted_hours}h)`;
      select.appendChild(opt);
    });
  },

  setupModals() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });

    const dateInput = document.getElementById('slot-date-input');
    const startInput = document.getElementById('slot-start-input');
    const endInput = document.getElementById('slot-end-input');
    const regexInput = document.getElementById('slot-duration-regex-input');

    const updatePreview = () => this.updateSlotModalPreview();
    if (dateInput) dateInput.addEventListener('change', updatePreview);
    
    if (startInput) {
      startInput.addEventListener('input', () => {
        // If regex duration exists, calculate end time
        if (regexInput && regexInput.value.trim()) {
          this.applyRegexDurationToEndTime();
        }
        updatePreview();
      });
    }

    if (endInput) {
      endInput.addEventListener('input', () => {
        // Sync duration regex input based on start and end
        if (startInput && startInput.value && endInput.value) {
          const sMin = this.timeToMinutes(startInput.value);
          const eMin = this.timeToMinutes(endInput.value);
          if (eMin > sMin) {
            const dur = (eMin - sMin) / 60.0;
            if (regexInput) regexInput.value = this.formatJiraDuration(dur);
          }
        }
        updatePreview();
      });
    }

    if (regexInput) {
      regexInput.addEventListener('input', () => {
        this.applyRegexDurationToEndTime();
        updatePreview();
      });
    }
  },

  applyRegexDurationToEndTime() {
    const startInput = document.getElementById('slot-start-input');
    const endInput = document.getElementById('slot-end-input');
    const regexInput = document.getElementById('slot-duration-regex-input');
    if (!startInput || !endInput || !regexInput) return;

    const val = regexInput.value.trim();
    if (!val) return;

    const parsedHours = this.parseDuration(val);
    if (parsedHours && parsedHours > 0) {
      const sMin = this.timeToMinutes(startInput.value || '09:00');
      const eMin = sMin + Math.round(parsedHours * 60);
      const h = Math.floor((eMin / 60) % 24);
      const m = eMin % 60;
      endInput.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
  },

  // Time Slot Modal
  openTimeSlotModal(taskId = null, dateStr = null, startTime = null, endTime = null) {
    const modal = document.getElementById('modal-time-slot');
    const taskSelect = document.getElementById('slot-task-select');
    const dateInput = document.getElementById('slot-date-input');
    const startInput = document.getElementById('slot-start-input');
    const endInput = document.getElementById('slot-end-input');
    const regexInput = document.getElementById('slot-duration-regex-input');
    const notesInput = document.getElementById('slot-notes-input');
    const allowOverlapCheckbox = document.getElementById('slot-allow-overlap');

    if (taskId && taskSelect) taskSelect.value = taskId;
    if (dateInput) {
      dateInput.value = dateStr || this.formatDateIso(new Date());
    }
    if (startInput) {
      startInput.value = startTime || '09:00';
    }
    if (endInput) {
      endInput.value = endTime || '11:00';
    }
    if (regexInput) {
      regexInput.value = '2h';
    }
    if (notesInput) notesInput.value = '';
    if (allowOverlapCheckbox) allowOverlapCheckbox.checked = false;

    this.updateSlotModalPreview();
    if (modal) modal.classList.add('open');
  },

  closeTimeSlotModal() {
    const modal = document.getElementById('modal-time-slot');
    if (modal) modal.classList.remove('open');
  },

  async updateSlotModalPreview() {
    const dateInput = document.getElementById('slot-date-input');
    const startInput = document.getElementById('slot-start-input');
    const endInput = document.getElementById('slot-end-input');
    const regexInput = document.getElementById('slot-duration-regex-input');
    const durationDisplay = document.getElementById('slot-duration-display');
    const conflictBox = document.getElementById('slot-conflict-warning');
    const occupiedTimeline = document.getElementById('modal-day-occupancy-preview');

    if (!dateInput || !startInput || !endInput) return;

    const dateVal = dateInput.value;
    const startVal = startInput.value;
    const endVal = endInput.value;
    const hoursPerDay = this.activeSprint ? (this.activeSprint.hours_per_day || 8.0) : 8.0;

    // Calculate duration & show Jira regex breakdown
    if (startVal && endVal) {
      const sMin = this.timeToMinutes(startVal);
      const eMin = this.timeToMinutes(endVal);
      if (eMin > sMin) {
        const durHours = ((eMin - sMin) / 60.0);
        const jiraFmt = this.formatJiraDuration(durHours);
        if (durationDisplay) {
          durationDisplay.innerHTML = `⏱️ Duration: <strong>${durHours.toFixed(2)} Hours</strong> (${jiraFmt}) <span style="font-size: 0.725rem; color: var(--text-faint); margin-left: 6px;">[1d = ${hoursPerDay}h]</span>`;
        }
      } else {
        if (durationDisplay) durationDisplay.textContent = `⚠️ End time must be after start time`;
      }
    }

    // Fetch this day's schedule to show occupied slots
    if (dateVal) {
      try {
        const schedule = await API.getDaySchedule(dateVal, this.activeSprint ? this.activeSprint.id : null);
        
        if (occupiedTimeline) {
          occupiedTimeline.innerHTML = '';
          const dayStart = 8 * 60; // 08:00
          const totalDur = 12 * 60; // 720m

          if (schedule.slots.length === 0) {
            const offLabel = schedule.is_off_day ? ` (${schedule.off_day_reason})` : '';
            occupiedTimeline.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-faint); margin: auto;">No slots booked on this day yet${offLabel}</span>`;
          } else {
            schedule.slots.forEach(s => {
              const sm = this.timeToMinutes(s.start_time);
              const em = this.timeToMinutes(s.end_time);
              const leftPct = Math.max(0, Math.min(100, ((sm - dayStart) / totalDur) * 100));
              const widthPct = Math.max(3, Math.min(100 - leftPct, ((em - sm) / totalDur) * 100));

              const block = document.createElement('div');
              block.style.position = 'absolute';
              block.style.top = '3px';
              block.style.bottom = '3px';
              block.style.left = `${leftPct}%`;
              block.style.width = `${widthPct}%`;
              block.style.background = s.color || '#6366f1';
              block.style.borderRadius = '3px';
              block.style.fontSize = '0.65rem';
              block.style.color = '#fff';
              block.style.fontWeight = '600';
              block.style.display = 'flex';
              block.style.alignItems = 'center';
              block.style.padding = '0 4px';
              block.style.overflow = 'hidden';
              block.style.whiteSpace = 'nowrap';
              block.title = `${s.key}: ${s.start_time} - ${s.end_time}`;
              block.textContent = `${s.key} ${s.start_time}`;
              occupiedTimeline.appendChild(block);
            });
          }
        }

        // Overlap warning check
        if (conflictBox && startVal && endVal) {
          const sMin = this.timeToMinutes(startVal);
          const eMin = this.timeToMinutes(endVal);

          const conflicts = schedule.slots.filter(s => {
            const sm = this.timeToMinutes(s.start_time);
            const em = this.timeToMinutes(s.end_time);
            return sMin < em && eMin > sm;
          });

          if (conflicts.length > 0) {
            const list = conflicts.map(c => `<strong>${c.key}</strong> (${c.start_time} - ${c.end_time}: "${c.title}")`).join(', ');
            conflictBox.innerHTML = `⚠️ <strong>Time Conflict!</strong> This slot overlaps with: ${list}. Tick "Allow Overlap" if intentional.`;
            conflictBox.classList.add('active');
          } else {
            conflictBox.classList.remove('active');
          }
        }
      } catch (err) {
        console.warn('Could not preview day occupancy:', err);
      }
    }
  },

  async submitTimeSlot() {
    const taskSelect = document.getElementById('slot-task-select');
    const dateInput = document.getElementById('slot-date-input');
    const startInput = document.getElementById('slot-start-input');
    const endInput = document.getElementById('slot-end-input');
    const regexInput = document.getElementById('slot-duration-regex-input');
    const notesInput = document.getElementById('slot-notes-input');
    const allowOverlapCheckbox = document.getElementById('slot-allow-overlap');

    const taskId = parseInt(taskSelect.value, 10);
    const dateStr = dateInput.value;
    const startTime = startInput.value;
    const endTime = endInput.value;
    const durationStr = regexInput ? regexInput.value.trim() : null;
    const notes = notesInput.value;
    const allowOverlap = allowOverlapCheckbox ? allowOverlapCheckbox.checked : false;

    if (!taskId) {
      this.showToast('Please select a task to log time for', 'error');
      return;
    }
    if (!dateStr || !startTime) {
      this.showToast('Please specify date and start time', 'error');
      return;
    }

    try {
      await API.createTimeSlot({
        task_id: taskId,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        duration_str: durationStr,
        notes: notes,
        allow_overlap: allowOverlap,
      });

      this.showToast(`Time slot logged successfully!`, 'success');
      this.closeTimeSlotModal();
      await this.reloadAll();
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  },

  // Task Creation Modal
  openCreateTaskModal() {
    const modal = document.getElementById('modal-create-task');
    if (modal) modal.classList.add('open');
  },

  closeCreateTaskModal() {
    const modal = document.getElementById('modal-create-task');
    if (modal) modal.classList.remove('open');
  },

  async submitCreateTask() {
    const title = document.getElementById('task-title-input').value.trim();
    const desc = document.getElementById('task-desc-input').value.trim();
    const sp = parseFloat(document.getElementById('task-sp-input').value) || 1.0;
    const allocatedStr = document.getElementById('task-allocated-time-input').value.trim();
    const priority = document.getElementById('task-priority-input').value;
    const color = document.getElementById('task-color-input').value;
    const assignee = document.getElementById('task-assignee-input').value.trim() || 'Me';

    if (!title) {
      this.showToast('Please enter a task title', 'error');
      return;
    }

    try {
      const activeSprint = this.activeSprint;
      const res = await API.createTask({
        title,
        description: desc,
        sprint_id: activeSprint ? activeSprint.id : null,
        story_points: sp,
        allocated_time_str: allocatedStr,
        priority,
        color,
        assignee
      });

      this.showToast(`Created task ${res.key}!`, 'success');
      this.closeCreateTaskModal();
      document.getElementById('form-create-task').reset();
      await this.reloadAll();
    } catch (err) {
      this.showToast(`Failed to create task: ${err.message}`, 'error');
    }
  },

  // Subtask Management
  openSubtaskModal(parentId, parentKey) {
    const modal = document.getElementById('modal-create-subtask');
    const parentHidden = document.getElementById('subtask-parent-id-hidden');
    const keyBadge = document.getElementById('subtask-parent-key-badge');
    const form = document.getElementById('form-create-subtask');
    if (form) form.reset();

    if (parentHidden) parentHidden.value = parentId;
    if (keyBadge) keyBadge.textContent = parentKey;
    if (modal) modal.classList.add('open');
  },

  closeSubtaskModal() {
    const modal = document.getElementById('modal-create-subtask');
    if (modal) modal.classList.remove('open');
  },

  async submitCreateSubtask() {
    const parentId = parseInt(document.getElementById('subtask-parent-id-hidden').value, 10);
    const title = document.getElementById('subtask-title-input').value.trim();
    const allocatedStr = document.getElementById('subtask-allocated-time-input').value.trim();
    const assignee = document.getElementById('subtask-assignee-input').value.trim() || 'Me';

    if (!title) {
      this.showToast('Please enter subtask title', 'error');
      return;
    }

    try {
      const res = await API.createSubtask(parentId, {
        title,
        allocated_time_str: allocatedStr,
        assignee
      });
      this.showToast(`Subtask ${res.key} created!`, 'success');
      this.closeSubtaskModal();
      await this.reloadAll();
    } catch (err) {
      this.showToast(`Failed to create subtask: ${err.message}`, 'error');
    }
  },

  async toggleSubtask(subtaskId) {
    try {
      const res = await API.toggleSubtask(subtaskId);
      this.showToast(`Subtask marked as ${res.status}`, 'success');
      await this.reloadAll();
    } catch (err) {
      this.showToast(`Error updating subtask: ${err.message}`, 'error');
    }
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : (type === 'warning' ? '⚠️' : '✕');
    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  },

  formatDateIso(d) {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

function roundTwo(n) {
  return Math.round(n * 100) / 100;
}

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
