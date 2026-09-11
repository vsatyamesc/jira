// Analytics & Story Points Budget Module

const Analytics = {
  async render(tasks, activeSprint) {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    const hoursPerSp = activeSprint ? activeSprint.hours_per_sp : 8.0;
    const totalSp = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const totalBudgetHours = totalSp * hoursPerSp;
    const totalLoggedHours = tasks.reduce((sum, t) => sum + (t.logged_hours || 0), 0);
    const sprintProgressPct = totalBudgetHours > 0 ? Math.min(100, Math.round((totalLoggedHours / totalBudgetHours) * 100)) : 0;

    let html = `
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">⚡ Sprint Story Point Budget</h3>
            <span class="brand-tag">${activeSprint ? activeSprint.name : 'Sprint 1'}</span>
          </div>
          <div class="sp-velocity-stats">
            <div class="velocity-metric-row">
              <span style="color: var(--text-muted);">Total Sprint Story Points</span>
              <strong style="font-family: var(--font-mono); font-size: 1.1rem; color: var(--accent-cyan);">${totalSp} SP</strong>
            </div>
            <div class="velocity-metric-row">
              <span style="color: var(--text-muted);">Configured Ratio</span>
              <span style="font-family: var(--font-mono); color: #a5b4fc; background: rgba(99, 102, 241, 0.15); padding: 2px 8px; border-radius: 4px;">
                1 SP = ${hoursPerSp} Hours
              </span>
            </div>
            <div class="velocity-metric-row">
              <span style="color: var(--text-muted);">Total Budgeted Time</span>
              <strong style="font-family: var(--font-mono); font-size: 1.1rem; color: #fff;">${totalBudgetHours.toFixed(1)} Hours</strong>
            </div>
            <div class="velocity-metric-row">
              <span style="color: var(--text-muted);">Total Logged Time</span>
              <strong style="font-family: var(--font-mono); font-size: 1.1rem; color: var(--accent-emerald);">${totalLoggedHours.toFixed(1)} Hours</strong>
            </div>
            <div class="velocity-metric-row">
              <span style="color: var(--text-muted);">Sprint Capacity Remaining</span>
              <strong style="font-family: var(--font-mono); color: var(--accent-amber);">${Math.max(0, totalBudgetHours - totalLoggedHours).toFixed(1)} Hours</strong>
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <div class="analytics-card-header">
            <h3 class="analytics-card-title">📊 Sprint Burn-up Progress</h3>
            <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${sprintProgressPct}% Completed</span>
          </div>
          <div style="margin: 1rem 0;">
            <div class="progress-bar-bg" style="height: 14px;">
              <div class="progress-bar-fill" style="width: ${sprintProgressPct}%;"></div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.775rem; color: var(--text-muted);">
            <span>0h (Start)</span>
            <span>Current: <strong>${totalLoggedHours.toFixed(1)}h</strong></span>
            <span>Target: <strong>${totalBudgetHours.toFixed(1)}h</strong></span>
          </div>
          
          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Adjust SP to Hours Ratio:</span>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="number" id="input-adjust-ratio" value="${hoursPerSp}" step="0.5" min="1" max="24" style="width: 65px; padding: 4px 8px; background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); color: #fff; border-radius: 4px; font-family: var(--font-mono); text-align: center;">
              <button class="btn btn-secondary btn-sm" onclick="Analytics.updateRatio()">Apply</button>
            </div>
          </div>
        </div>
      </div>

      <div class="analytics-card" style="margin-top: 1.5rem;">
        <div class="analytics-card-header">
          <h3 class="analytics-card-title">📋 Task Story Point Breakdown & Logged Sessions</h3>
        </div>
        <div style="overflow-x: auto;">
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Task Title</th>
                <th>Status</th>
                <th>Story Points</th>
                <th>Budget (Hours)</th>
                <th>Logged (Hours)</th>
                <th>Variance / Remaining</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
    `;

    tasks.forEach(task => {
      const budget = (task.story_points || 1.0) * hoursPerSp;
      const logged = task.logged_hours || 0;
      const diff = budget - logged;
      const pct = budget > 0 ? Math.min(100, Math.round((logged / budget) * 100)) : 0;

      html += `
        <tr>
          <td><span class="task-key-badge">${task.key}</span></td>
          <td style="font-weight: 600; color: #fff;">${this.escapeHtml(task.title)}</td>
          <td>
            <span class="column-dot ${task.status}" style="display: inline-block; margin-right: 4px;"></span>
            <span style="text-transform: capitalize; color: var(--text-muted);">${task.status.replace('_', ' ')}</span>
          </td>
          <td><strong style="font-family: var(--font-mono); color: var(--accent-cyan);">${task.story_points} SP</strong></td>
          <td style="font-family: var(--font-mono);">${budget.toFixed(1)}h</td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${logged.toFixed(1)}h</td>
          <td style="font-family: var(--font-mono); color: ${diff >= 0 ? 'var(--text-muted)' : 'var(--accent-rose)'};">
            ${diff >= 0 ? `${diff.toFixed(1)}h left` : `+${Math.abs(diff).toFixed(1)}h over`}
          </td>
          <td style="min-width: 120px;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="mini-progress-bar" style="flex: 1;">
                <div class="mini-progress-fill ${pct >= 100 ? 'completed' : ''}" style="width: ${pct}%;"></div>
              </div>
              <span style="font-size: 0.725rem; font-family: var(--font-mono); color: var(--text-muted);">${pct}%</span>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  async updateRatio() {
    const input = document.getElementById('input-adjust-ratio');
    if (!input) return;
    const newRatio = parseFloat(input.value);
    if (!newRatio || newRatio <= 0) {
      App.showToast('Please enter a valid ratio (e.g. 8)', 'error');
      return;
    }

    const activeSprint = App.activeSprint;
    if (!activeSprint) return;

    try {
      await API.updateSprint(activeSprint.id, { hours_per_sp: newRatio });
      App.showToast(`Story point ratio updated: 1 SP = ${newRatio} Hours`, 'success');
      await App.reloadAll();
    } catch (err) {
      App.showToast(`Error updating ratio: ${err.message}`, 'error');
    }
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
