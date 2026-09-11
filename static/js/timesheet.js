// Excel-Style Timesheet Matrix Module (Tasks x Days + Daily Aggregates + CSV Export)

const Timesheet = {
  currentStartDate: null,
  cachedData: null,

  init() {
    const today = new Date();
    // Monday of current week
    const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOffset);
    this.currentStartDate = this.formatDateIso(monday);

    this.setupEventListeners();
  },

  setupEventListeners() {
    const prevBtn = document.getElementById('btn-ts-prev');
    const nextBtn = document.getElementById('btn-ts-next');
    const currentWeekBtn = document.getElementById('btn-ts-current');
    const exportBtn = document.getElementById('btn-export-csv');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const d = new Date(this.currentStartDate);
        d.setDate(d.getDate() - 7);
        this.currentStartDate = this.formatDateIso(d);
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const d = new Date(this.currentStartDate);
        d.setDate(d.getDate() + 7);
        this.currentStartDate = this.formatDateIso(d);
        this.render();
      });
    }

    if (currentWeekBtn) {
      currentWeekBtn.addEventListener('click', () => {
        const today = new Date();
        const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOffset);
        this.currentStartDate = this.formatDateIso(monday);
        this.render();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const activeSprint = App.activeSprint;
        const sprintId = activeSprint ? activeSprint.id : null;
        window.location.href = API.getExportCsvUrl(sprintId);
        App.showToast('Generating and downloading Timesheet CSV for Excel...', 'success');
      });
    }
  },

  async render() {
    const container = document.getElementById('timesheet-table-wrapper');
    const rangeLabel = document.getElementById('timesheet-range-label');
    if (!container) return;

    try {
      const activeSprint = App.activeSprint;
      const sprintId = activeSprint ? activeSprint.id : null;
      const data = await API.getTimesheet(sprintId, this.currentStartDate, 7);
      this.cachedData = data;

      if (rangeLabel && data.date_columns.length > 0) {
        const first = data.date_columns[0];
        const last = data.date_columns[data.date_columns.length - 1];
        rangeLabel.textContent = `${first.formatted} – ${last.formatted}`;
      }

      let html = `
        <table class="timesheet-table">
          <thead>
            <tr>
              <th class="th-task-col">Task & Story Points</th>
              <th style="min-width: 90px; text-align: center;">Status</th>
      `;

      // Date column headers
      data.date_columns.forEach(col => {
        const isToday = col.is_today ? 'today' : '';
        const isOff = col.is_off_day ? 'is-off-day' : '';
        html += `
          <th class="th-date-col ${isToday} ${isOff}">
            <div>${col.day_name}</div>
            <div style="font-size: 0.825rem; font-weight: 700;">${col.formatted}</div>
            ${col.is_off_day ? `<span class="off-day-pill">${col.off_day_reason.split(' ')[0]}</span>` : `<span style="font-size: 0.65rem; color: var(--text-faint);">${col.target_hours}h target</span>`}
          </th>
        `;
      });

      // Total Header
      html += `
              <th class="th-total-col">
                <div>Total Logged</div>
                <div style="font-size: 0.7rem; color: var(--accent-cyan);">SP Budget</div>
              </th>
            </tr>
          </thead>
          <tbody>
      `;

      // Render Task Rows
      data.rows.forEach(row => {
        const task = row.task;
        const pct = Math.min(100, row.percent_spent || 0);

        html += `
          <tr class="matrix-row">
            <td class="task-col">
              <div class="task-cell-content">
                <div class="task-color-indicator" style="background-color: ${task.color || '#6366f1'}"></div>
                <div style="overflow: hidden;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2px;">
                    <span class="matrix-task-key">${task.key}</span>
                    <span class="task-priority-badge priority-${task.priority}" style="font-size: 0.625rem; padding: 1px 5px;">${task.priority}</span>
                  </div>
                  <div class="matrix-task-title" title="${this.escapeHtml(task.title)}">${this.escapeHtml(task.title)}</div>
                </div>
                <span class="matrix-sp-badge" title="${task.story_points} SP = ${row.budgeted_hours}h budget">
                  ${task.story_points} SP (${row.budgeted_hours}h)
                </span>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="column-dot ${task.status}" style="display: inline-block; margin-right: 4px;"></span>
              <span style="font-size: 0.75rem; text-transform: capitalize; color: var(--text-muted);">${task.status.replace('_', ' ')}</span>
            </td>
        `;

        // Render Day Cells for this Task
        data.date_columns.forEach(col => {
          const cell = row.cells[col.date];
          const hasHours = cell && cell.hours > 0;

          if (hasHours) {
            html += `
              <td class="matrix-cell ${col.is_off_day ? 'is-off-day' : ''}" onclick="Timesheet.showCellDetails(${task.id}, '${col.date}', '${task.key}')" title="Click to view/manage ${cell.slots_count} session(s)">
                <span class="cell-hours-val">${cell.hours}h</span>
                <span class="cell-slots-count">${cell.slots_count} slot${cell.slots_count > 1 ? 's' : ''}</span>
              </td>
            `;
          } else {
            html += `
              <td class="matrix-cell ${col.is_off_day ? 'is-off-day' : ''}" onclick="App.openTimeSlotModal(${task.id}, '${col.date}')" title="Click to log time for ${task.key} on ${col.date}">
                <span class="cell-hours-val empty">+</span>
              </td>
            `;
          }
        });

        // Row Total column
        html += `
            <td class="th-total-col" style="vertical-align: middle;">
              <div class="row-total-content">
                <span class="row-total-val">${row.total_logged_hours}h</span>
                <span class="row-total-budget">of ${row.budgeted_hours}h (${pct}%)</span>
                <div class="mini-progress-bar" style="width: 90px; margin-top: 2px;">
                  <div class="mini-progress-fill ${pct >= 100 ? 'completed' : ''}" style="width: ${pct}%"></div>
                </div>
              </div>
            </td>
          </tr>
        `;
      });

      // Bottom Row: Daily Aggregates (The Daily Sum!)
      html += `
          <tr class="aggregate-row">
            <td colspan="2" style="text-align: right; padding-right: 1.5rem; font-weight: 700; color: #fff;">
              <span>⚡ DAILY AGGREGATE LOGGED:</span>
            </td>
      `;

      data.daily_aggregates.forEach(agg => {
        const statusClass = agg.status;
        const target = agg.target_hours;
        let subLabel = '';
        if (agg.is_off_day) {
          subLabel = agg.total_hours > 0 ? 'Off-Day Work' : 'Day Off';
        } else {
          subLabel = agg.total_hours >= target ? `✓ ${target}h Goal` : (agg.total_hours > 0 ? `${(target - agg.total_hours).toFixed(1)}h left` : '0h');
        }

        html += `
          <td style="text-align: center;">
            <div class="daily-sum-pill ${statusClass}" title="${agg.total_hours}h logged (Target: ${target}h)">
              <span class="daily-sum-hours">${agg.total_hours}h</span>
              <span class="daily-sum-label">${subLabel}</span>
            </div>
          </td>
        `;
      });

      // Grand Total Cell
      html += `
            <td style="text-align: right; background: rgba(99, 102, 241, 0.15);">
              <div class="row-total-content">
                <span class="row-total-val" style="color: var(--accent-cyan); font-size: 1.05rem;">${data.grand_total_hours}h</span>
                <span class="row-total-budget" style="color: #cbd5e1;">Sprint Total</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      `;

      container.innerHTML = html;

    } catch (err) {
      console.error('Error rendering timesheet:', err);
      container.innerHTML = `<div style="padding: 2rem; color: var(--accent-rose);">Failed to load timesheet: ${err.message}</div>`;
    }
  },

  showCellDetails(taskId, dateStr, taskKey) {
    if (!this.cachedData) return;
    const row = this.cachedData.rows.find(r => r.task.id === taskId);
    if (!row) return;
    const cell = row.cells[dateStr];
    if (!cell || !cell.slots || cell.slots.length === 0) {
      App.openTimeSlotModal(taskId, dateStr);
      return;
    }

    // Open cell slot drawer / modal
    const modal = document.getElementById('modal-cell-slots');
    const title = document.getElementById('cell-slots-modal-title');
    const content = document.getElementById('cell-slots-modal-content');
    const btnAddMore = document.getElementById('btn-cell-add-more');

    if (title) title.textContent = `${taskKey} Logged Sessions on ${dateStr}`;
    if (btnAddMore) {
      btnAddMore.onclick = () => {
        Timesheet.closeCellModal();
        App.openTimeSlotModal(taskId, dateStr);
      };
    }

    if (content) {
      let slotsHtml = `
        <div style="margin-bottom: 0.85rem; font-size: 0.85rem; color: var(--text-muted);">
          Total for this task on ${dateStr}: <strong style="color: #fff;">${cell.hours} hours</strong>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
      `;

      cell.slots.forEach(s => {
        slotsHtml += `
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-left: 4px solid ${row.task.color || '#6366f1'}; border-radius: var(--radius-sm); padding: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan);">
                ⏱️ ${s.start_time} - ${s.end_time} (${s.duration_hours}h)
              </div>
              ${s.notes ? `<div style="font-size: 0.775rem; color: var(--text-muted); margin-top: 3px;">"${this.escapeHtml(s.notes)}"</div>` : ''}
            </div>
            <button class="btn btn-danger btn-sm" onclick="Timesheet.deleteSlotFromCell(${s.id})">
              Delete
            </button>
          </div>
        `;
      });

      slotsHtml += `</div>`;
      content.innerHTML = slotsHtml;
    }

    if (modal) modal.classList.add('open');
  },

  closeCellModal() {
    const modal = document.getElementById('modal-cell-slots');
    if (modal) modal.classList.remove('open');
  },

  async deleteSlotFromCell(slotId) {
    if (!confirm('Delete this time slot?')) return;
    try {
      await API.deleteTimeSlot(slotId);
      this.closeCellModal();
      App.showToast('Slot deleted', 'success');
      await App.reloadAll();
    } catch (err) {
      App.showToast(`Error: ${err.message}`, 'error');
    }
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
