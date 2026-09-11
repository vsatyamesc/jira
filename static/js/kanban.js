// Kanban Board Module

const Kanban = {
  tasks: [],

  init() {
    this.setupDropZones();
  },

  render(tasks) {
    this.tasks = tasks;

    const columns = {
      todo: document.getElementById('column-cards-todo'),
      in_progress: document.getElementById('column-cards-in_progress'),
      in_review: document.getElementById('column-cards-in_review'),
      done: document.getElementById('column-cards-done'),
    };

    const counters = {
      todo: document.getElementById('counter-todo'),
      in_progress: document.getElementById('counter-in_progress'),
      in_review: document.getElementById('counter-in_review'),
      done: document.getElementById('counter-done'),
    };

    // Clear existing cards
    Object.values(columns).forEach(col => {
      if (col) col.innerHTML = '';
    });

    const counts = { todo: 0, in_progress: 0, in_review: 0, done: 0 };

    tasks.forEach(task => {
      const status = task.status || 'todo';
      const col = columns[status] || columns.todo;
      counts[status] = (counts[status] || 0) + 1;

      const card = this.createTaskCard(task);
      col.appendChild(card);
    });

    // Update column counters
    Object.keys(counters).forEach(key => {
      if (counters[key]) {
        counters[key].textContent = counts[key] || 0;
      }
    });
  },

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.id = `task-card-${task.id}`;
    card.setAttribute('data-task-id', task.id);
    card.style.setProperty('--card-color', task.color || '#6366f1');

    const pct = Math.min(100, task.percent_spent || 0);
    const isCompleted = task.status === 'done' || pct >= 100;

    card.innerHTML = `
      <div class="task-card-header">
        <span class="task-key-badge">${task.key}</span>
        <span class="task-priority-badge priority-${task.priority}">${task.priority}</span>
      </div>
      <div class="task-card-title">${this.escapeHtml(task.title)}</div>
      
      <div class="task-budget-box">
        <div class="task-budget-stats">
          <span class="sp-pill" title="Story Points">
            ⚡ ${task.story_points} SP
          </span>
          <span class="hours-spent-ratio" title="Allocated: ${task.budgeted_hours}h (${task.allocated_jira_str || ''})">
            Allocated: <strong>${task.budgeted_hours}h</strong> ${task.allocated_jira_str ? `(${task.allocated_jira_str})` : ''}
          </span>
        </div>
        <div class="task-budget-stats" style="margin-top: 2px;">
          <span style="font-size: 0.7rem; color: var(--text-muted);">
            Logged: <strong style="color: #fff;">${task.logged_hours}h</strong>
          </span>
          <span style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--accent-cyan);">
            ${pct}% (${task.remaining_hours}h left)
          </span>
        </div>
        <div class="mini-progress-bar" style="margin-top: 4px;">
          <div class="mini-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${pct}%"></div>
        </div>
      </div>

      <!-- Subtasks Section -->
      ${task.subtasks && task.subtasks.length > 0 ? `
        <div class="card-subtasks-container">
          <div class="subtasks-header">
            <span>Subtasks (${task.subtasks_done_count}/${task.subtasks_count})</span>
            <button class="btn-mini-add-subtask" onclick="event.stopPropagation(); App.openSubtaskModal(${task.id}, '${this.escapeHtml(task.key)}')">+ Add</button>
          </div>
          <div class="subtasks-list">
            ${task.subtasks.map(st => `
              <div class="subtask-item ${st.status === 'done' ? 'done' : ''}">
                <input type="checkbox" ${st.status === 'done' ? 'checked' : ''} onchange="event.stopPropagation(); App.toggleSubtask(${st.id})">
                <span class="subtask-text" style="flex: 1; font-weight: 500;">
                  <strong style="font-family: var(--font-mono); color: #a5b4fc; font-size: 0.7rem;">${st.key}</strong>
                  ${this.escapeHtml(st.title)}
                </span>
                ${st.allocated_hours ? `<span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">${st.allocated_hours}h</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="card-subtasks-container" style="display: flex; justify-content: flex-end;">
          <button class="btn-mini-add-subtask" onclick="event.stopPropagation(); App.openSubtaskModal(${task.id}, '${this.escapeHtml(task.key)}')">+ Add Subtask</button>
        </div>
      `}

      <div class="task-card-footer">
        <div class="task-assignee">
          <div class="avatar-chip">${(task.assignee || 'Me').charAt(0).toUpperCase()}</div>
          <span>${this.escapeHtml(task.assignee || 'Me')}</span>
        </div>
        <button class="btn-card-log-slot" onclick="App.openTimeSlotModal(${task.id})">
          + Log Slot
        </button>
      </div>
    `;

    // Drag events
    card.addEventListener('dragstart', (e) => {
      // Fix visual shrinking bug: lock width to exact pixel width before browser snapshot
      const rect = card.getBoundingClientRect();
      card.style.width = `${rect.width}px`;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.style.width = '100%';
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
    });

    return card;
  },

  setupDropZones() {
    const columns = document.querySelectorAll('.kanban-column');

    columns.forEach(column => {
      column.addEventListener('dragenter', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });

      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', (e) => {
        if (!column.contains(e.relatedTarget)) {
          column.classList.remove('drag-over');
        }
      });

      column.addEventListener('drop', async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = column.getAttribute('data-status');

        if (taskId && newStatus) {
          try {
            await API.updateTask(taskId, { status: newStatus });
            App.showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'success');
            await App.reloadAll();
          } catch (err) {
            App.showToast(`Failed to move task: ${err.message}`, 'error');
          }
        }
      });
    });
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
