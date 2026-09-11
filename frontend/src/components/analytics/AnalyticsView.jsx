import React, { useState } from 'react';
import { BarChart3, TrendingUp, Zap, Clock, CheckCircle } from 'lucide-react';
import API from '../../api/client';

export default function AnalyticsView({
  tasks,
  activeSprint,
  onSprintUpdated,
  showToast,
}) {
  const hoursPerSp = activeSprint ? activeSprint.hours_per_sp : 8.0;
  const [ratioInput, setRatioInput] = useState(hoursPerSp);

  const totalSp = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const totalBudgetHours = totalSp * hoursPerSp;
  const totalLoggedHours = tasks.reduce((sum, t) => sum + (t.logged_hours || 0), 0);
  const sprintProgressPct = totalBudgetHours > 0
    ? Math.min(100, Math.round((totalLoggedHours / totalBudgetHours) * 100))
    : 0;

  const handleUpdateRatio = async () => {
    const val = parseFloat(ratioInput);
    if (!val || val <= 0) {
      showToast('Please enter a valid positive ratio', 'error');
      return;
    }

    if (!activeSprint) return;
    try {
      await API.updateSprint(activeSprint.id, { hours_per_sp: val });
      showToast(`Updated ratio: 1 SP = ${val} Hours`, 'success');
      onSprintUpdated();
    } catch (err) {
      showToast(`Failed to update ratio: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      {/* Top Velocity & Burn-Up Row */}
      <div className="analytics-grid-layout">
        {/* Sprint Velocity Card */}
        <div className="analytics-card">
          <div className="analytics-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="var(--accent-blue)" /> Sprint Story Point Velocity
            </span>
            <span className="brand-tag">{activeSprint ? activeSprint.name : 'Sprint'}</span>
          </div>

          <div className="metric-line">
            <span style={{ color: 'var(--text-muted)' }}>Total Sprint Story Points</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
              {totalSp} SP
            </strong>
          </div>

          <div className="metric-line">
            <span style={{ color: 'var(--text-muted)' }}>Configured Ratio</span>
            <span className="stat-badge-pill" style={{ background: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent-blue)' }}>
              1 SP = {hoursPerSp} Hours
            </span>
          </div>

          <div className="metric-line">
            <span style={{ color: 'var(--text-muted)' }}>Total Budgeted Capacity</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{totalBudgetHours.toFixed(1)} Hours</strong>
          </div>

          <div className="metric-line">
            <span style={{ color: 'var(--text-muted)' }}>Total Logged Time</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
              {totalLoggedHours.toFixed(1)} Hours
            </strong>
          </div>

          <div className="metric-line">
            <span style={{ color: 'var(--text-muted)' }}>Capacity Remaining</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
              {Math.max(0, totalBudgetHours - totalLoggedHours).toFixed(1)} Hours
            </strong>
          </div>
        </div>

        {/* Burn-Up Meter Card */}
        <div className="analytics-card">
          <div className="analytics-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="var(--accent-cyan)" /> Sprint Burn-Up Progress
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>
              {sprintProgressPct}%
            </span>
          </div>

          <div style={{ margin: '1.25rem 0' }}>
            <div className="progress-track" style={{ height: '12px' }}>
              <div className="progress-bar-fill" style={{ width: `${sprintProgressPct}%` }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span>0h (Start)</span>
            <span>Current: <strong style={{ color: 'var(--text-main)' }}>{totalLoggedHours.toFixed(1)}h</strong></span>
            <span>Target: <strong style={{ color: 'var(--text-main)' }}>{totalBudgetHours.toFixed(1)}h</strong></span>
          </div>

          {/* Inline Ratio Adjuster */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Adjust SP to Hours Ratio:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                className="form-input-control"
                value={ratioInput}
                step="0.5"
                min="1"
                max="24"
                onChange={(e) => setRatioInput(e.target.value)}
                style={{ width: '70px', padding: '4px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleUpdateRatio}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task Breakdown Table Card */}
      <div className="analytics-card">
        <div className="analytics-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={16} color="var(--accent-blue)" /> Task Story Point Breakdown & Variance
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="timesheet-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Task Title</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Story Points</th>
                <th style={{ textAlign: 'center' }}>Budget (Hours)</th>
                <th style={{ textAlign: 'center' }}>Logged (Hours)</th>
                <th style={{ textAlign: 'center' }}>Variance / Left</th>
                <th style={{ minWidth: '130px' }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const budget = (task.story_points || 1.0) * hoursPerSp;
                const logged = task.logged_hours || 0;
                const diff = budget - logged;
                const pct = budget > 0 ? Math.min(100, Math.round((logged / budget) * 100)) : 0;

                return (
                  <tr key={task.id}>
                    <td>
                      <span className="task-key-badge">{task.key}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{task.title}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`column-dot ${task.status || 'todo'}`} style={{ display: 'inline-block', marginRight: '4px' }} />
                      <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                        {task.status ? task.status.replace('_', ' ') : 'todo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {task.story_points} SP
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {budget.toFixed(1)}h
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {logged.toFixed(1)}h
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        color: diff >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                      }}
                    >
                      {diff >= 0 ? `${diff.toFixed(1)}h left` : `+${Math.abs(diff).toFixed(1)}h over`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="card-progress-track" style={{ flex: 1 }}>
                          <div
                            className={`card-progress-fill ${pct >= 100 ? 'completed' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
