// Visual Time-Slot Schedule Module (Day & Week Views)

const Schedule = {
  currentDate: new Date(),
  currentMode: 'day', // 'day' or 'week'

  init() {
    this.currentDate = new Date();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const prevBtn = document.getElementById('btn-schedule-prev');
    const nextBtn = document.getElementById('btn-schedule-next');
    const todayBtn = document.getElementById('btn-schedule-today');
    const dayModeBtn = document.getElementById('btn-mode-day');
    const weekModeBtn = document.getElementById('btn-mode-week');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentMode === 'day') {
          this.currentDate.setDate(this.currentDate.getDate() - 1);
        } else {
          this.currentDate.setDate(this.currentDate.getDate() - 7);
        }
        this.render();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentMode === 'day') {
          this.currentDate.setDate(this.currentDate.getDate() + 1);
        } else {
          this.currentDate.setDate(this.currentDate.getDate() + 7);
        }
        this.render();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.currentDate = new Date();
        this.render();
      });
    }

    if (dayModeBtn && weekModeBtn) {
      dayModeBtn.addEventListener('click', () => {
        this.currentMode = 'day';
        dayModeBtn.classList.add('active');
        weekModeBtn.classList.remove('active');
        this.render();
      });
      weekModeBtn.addEventListener('click', () => {
        this.currentMode = 'week';
        weekModeBtn.classList.add('active');
        dayModeBtn.classList.remove('active');
        this.render();
      });
    }
  },

  async render() {
    const dateStr = this.formatDateIso(this.currentDate);
    const dateDisplay = document.getElementById('schedule-date-display');
    const dayViewContainer = document.getElementById('schedule-day-view');
    const weekViewContainer = document.getElementById('schedule-week-view');

    if (this.currentMode === 'day') {
      if (dayViewContainer) dayViewContainer.style.display = 'block';
      if (weekViewContainer) weekViewContainer.style.display = 'none';
      if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = this.currentDate.toLocaleDateString(undefined, options);
      }
      await this.renderDayView(dateStr);
    } else {
      if (dayViewContainer) dayViewContainer.style.display = 'none';
      if (weekViewContainer) weekViewContainer.style.display = 'block';
      await this.renderWeekView();
    }
  },

  async renderDayView(dateStr) {
    try {
      const activeSprint = App.activeSprint;
      const sprintId = activeSprint ? activeSprint.id : null;
      const data = await API.getDaySchedule(dateStr, sprintId);
      
      // Update Daily Occupancy Badges
      const occupiedBadge = document.getElementById('occ-badge-occupied');
      const targetBadge = document.getElementById('occ-badge-target');
      const conflictBadge = document.getElementById('occ-badge-conflict');
      const visualBar = document.getElementById('day-visual-bar');

      if (occupiedBadge) {
        if (data.is_off_day) {
          occupiedBadge.textContent = `${data.total_day_hours}h Logged (${data.off_day_reason})`;
        } else {
          occupiedBadge.textContent = `${data.total_day_hours}h / ${data.target_day_hours}h Logged`;
        }
      }

      if (targetBadge) {
        if (data.is_off_day) {
          targetBadge.textContent = `Off-Day (0h Expected)`;
          targetBadge.className = 'occ-badge';
          targetBadge.style.background = 'rgba(244, 63, 94, 0.15)';
          targetBadge.style.color = '#fda4af';
        } else if (data.total_day_hours >= data.target_day_hours) {
          targetBadge.textContent = `Target Met (${data.target_day_hours}h+)`;
          targetBadge.className = 'occ-badge target';
          targetBadge.style.background = '';
          targetBadge.style.color = '';
        } else {
          targetBadge.textContent = `${data.remaining_day_hours}h Remaining`;
          targetBadge.className = 'occ-badge occupied';
          targetBadge.style.background = '';
          targetBadge.style.color = '';
        }
      }

      // Conflict warning
      if (conflictBadge) {
        if (data.collisions && data.collisions.length > 0) {
          conflictBadge.style.display = 'inline-block';
          conflictBadge.textContent = `⚠️ ${data.collisions.length} Conflict(s) Detected`;
        } else {
          conflictBadge.style.display = 'none';
        }
      }

      // Render Visual Timeline Bar (Workday 08:00 - 20:00 = 720 minutes)
      if (visualBar) {
        visualBar.innerHTML = '';
        const dayStartMin = 8 * 60; // 08:00
        const totalDurationMin = 12 * 60; // 12 hours window

        data.slots.forEach(slot => {
          const sMin = this.timeToMinutes(slot.start_time);
          const eMin = this.timeToMinutes(slot.end_time);

          // Calculate left and width percentage relative to 08:00 - 20:00
          const leftPct = Math.max(0, Math.min(100, ((sMin - dayStartMin) / totalDurationMin) * 100));
          const widthPct = Math.max(2, Math.min(100 - leftPct, ((eMin - sMin) / totalDurationMin) * 100));

          const block = document.createElement('div');
          block.className = 'visual-slot-block';
          block.style.left = `${leftPct}%`;
          block.style.width = `${widthPct}%`;
          block.style.backgroundColor = slot.color || '#6366f1';
          block.title = `${slot.key}: ${slot.title} (${slot.start_time} - ${slot.end_time}) [${slot.duration_hours}h]`;
          block.innerHTML = `<strong>${slot.key}</strong>&nbsp;${slot.start_time}-${slot.end_time}`;
          visualBar.appendChild(block);
        });
      }

      // Render Hourly Detailed Lanes (08:00 to 20:00)
      const gridContainer = document.getElementById('timeline-grid-lanes');
      if (gridContainer) {
        gridContainer.innerHTML = '';

        for (let hour = 8; hour <= 19; hour++) {
          const hourStr = `${hour.toString().padStart(2, '0')}:00`;
          const nextHourStr = `${(hour + 1).toString().padStart(2, '0')}:00`;

          const row = document.createElement('div');
          row.className = 'time-row';

          const label = document.createElement('div');
          label.className = 'time-label';
          label.textContent = hourStr;

          const lane = document.createElement('div');
          lane.className = 'time-slot-lane';
          lane.title = `Click to log work starting at ${hourStr}`;
          lane.addEventListener('click', (e) => {
            // Only trigger if clicked on the lane itself, not on an existing card
            if (e.target === lane) {
              App.openTimeSlotModal(null, dateStr, hourStr, nextHourStr);
            }
          });

          // Find slots that intersect with this hour
          const rowStartMin = hour * 60;
          const rowEndMin = (hour + 1) * 60;

          const matchedSlots = data.slots.filter(s => {
            const sm = this.timeToMinutes(s.start_time);
            const em = this.timeToMinutes(s.end_time);
            return sm < rowEndMin && em > rowStartMin;
          });

          // Render cards for slots that START in this hour
          matchedSlots.forEach(slot => {
            const sm = this.timeToMinutes(slot.start_time);
            if (sm >= rowStartMin && sm < rowEndMin) {
              const card = document.createElement('div');
              card.className = 'lane-block-card';
              card.style.setProperty('--slot-color', slot.color || '#6366f1');

              card.innerHTML = `
                <div class="lane-block-info">
                  <span class="lane-block-key">${slot.key}</span>
                  <div>
                    <div class="lane-block-title">${this.escapeHtml(slot.title)}</div>
                    ${slot.notes ? `<div class="lane-block-notes">"${this.escapeHtml(slot.notes)}"</div>` : ''}
                  </div>
                </div>
                <div class="lane-block-meta">
                  <span class="lane-time-badge">
                    ⏱️ ${slot.start_time} - ${slot.end_time} (${slot.duration_hours}h)
                  </span>
                  <button class="btn-slot-delete" title="Delete Time Slot" onclick="Schedule.deleteSlot(${slot.id})">
                    🗑️
                  </button>
                </div>
              `;
              lane.appendChild(card);
            }
          });

          row.appendChild(label);
          row.appendChild(lane);
          gridContainer.appendChild(row);
        }
      }
    } catch (err) {
      console.error('Error rendering day view:', err);
      App.showToast(`Could not load schedule: ${err.message}`, 'error');
    }
  },

  async renderWeekView() {
    const monday = new Date(this.currentDate);
    const dayOffset = monday.getDay() === 0 ? 6 : monday.getDay() - 1;
    monday.setDate(monday.getDate() - dayOffset);

    const dateDisplay = document.getElementById('schedule-date-display');
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    if (dateDisplay) {
      dateDisplay.textContent = `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    const weekContainer = document.getElementById('schedule-week-content');
    if (!weekContainer) return;

    try {
      const timesheetData = await API.getTimesheet(null, this.formatDateIso(monday), 7);
      
      let html = `
        <div class="week-grid-container">
          <div class="week-day-header" style="background: rgba(0,0,0,0.3);">
            <div class="week-day-name">Time</div>
            <div class="week-day-date">08:00-20:00</div>
          </div>
      `;

      timesheetData.date_columns.forEach(col => {
        const dailyAgg = timesheetData.daily_aggregates.find(d => d.date === col.date);
        const dayHours = dailyAgg ? dailyAgg.total_hours : 0;
        const isToday = col.is_today ? 'today' : '';

        html += `
          <div class="week-day-header ${isToday}" onclick="Schedule.switchToDay('${col.date}')" style="cursor: pointer;" title="Click to view full Day Schedule for ${col.date}">
            <div class="week-day-name">${col.day_name}</div>
            <div class="week-day-date">${col.formatted}</div>
            <div class="week-day-total">${dayHours}h / 8h</div>
          </div>
        `;
      });

      // Hour rows (08:00 to 19:00)
      for (let h = 8; h <= 19; h++) {
        const hourLabel = `${h.toString().padStart(2, '0')}:00`;
        html += `
          <div class="time-label" style="justify-content: center; font-size: 0.7rem; border-bottom: 1px solid var(--border-subtle); padding: 6px 0;">
            ${hourLabel}
          </div>
        `;

        timesheetData.date_columns.forEach(col => {
          // Find slots starting in this hour
          let cellSlots = [];
          timesheetData.rows.forEach(row => {
            const cell = row.cells[col.date];
            if (cell && cell.slots) {
              cell.slots.forEach(s => {
                const sm = Schedule.timeToMinutes(s.start_time);
                if (sm >= h * 60 && sm < (h + 1) * 60) {
                  cellSlots.push({ ...s, key: row.task.key, color: row.task.color });
                }
              });
            }
          });

          html += `
            <div class="time-slot-lane" style="border-bottom: 1px solid var(--border-subtle); min-height: 48px;" onclick="App.openTimeSlotModal(null, '${col.date}', '${hourLabel}', '${(h+1).toString().padStart(2, '0')}:00')">
          `;

          cellSlots.forEach(s => {
            html += `
              <div style="background: ${s.color || '#6366f1'}; color: #fff; font-size: 0.65rem; font-weight: 700; border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.key} (${s.start_time}-${s.end_time})">
                ${s.key} ${s.start_time}
              </div>
            `;
          });

          html += `</div>`;
        });
      }

      html += `</div>`;
      weekContainer.innerHTML = html;

    } catch (err) {
      console.error('Error rendering week view:', err);
    }
  },

  switchToDay(dateStr) {
    this.currentDate = new Date(dateStr);
    this.currentMode = 'day';
    const dayBtn = document.getElementById('btn-mode-day');
    const weekBtn = document.getElementById('btn-mode-week');
    if (dayBtn) dayBtn.classList.add('active');
    if (weekBtn) weekBtn.classList.remove('active');
    this.render();
  },

  async deleteSlot(slotId) {
    if (!confirm('Are you sure you want to delete this time slot?')) return;
    try {
      await API.deleteTimeSlot(slotId);
      App.showToast('Time slot removed', 'success');
      await App.reloadAll();
    } catch (err) {
      App.showToast(`Failed to delete time slot: ${err.message}`, 'error');
    }
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
