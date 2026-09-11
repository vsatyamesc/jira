import React, { useState, useEffect } from 'react';
import { X, Settings, Calendar } from 'lucide-react';
import API from '../../api/client';

export default function ManageSprintModal({
  isOpen,
  onClose,
  isEdit,
  sprint,
  onSprintSaved,
  showToast,
}) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('8.0');
  const [hoursPerSp, setHoursPerSp] = useState('8.0');
  const [weekOffs, setWeekOffs] = useState({ 0: false, 1: false, 2: false, 3: false, 4: false, 5: true, 6: true });
  const [dayOffs, setDayOffs] = useState('');
  const [status, setStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && sprint) {
      setName(sprint.name || '');
      setGoal(sprint.goal || '');
      setStartDate(sprint.start_date || '');
      setEndDate(sprint.end_date || '');
      setHoursPerDay(String(sprint.hours_per_day || 8.0));
      setHoursPerSp(String(sprint.hours_per_sp || 8.0));
      setDayOffs(sprint.day_offs || '');
      setStatus(sprint.status || 'active');

      const offMap = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
      if (sprint.week_offs) {
        sprint.week_offs.split(',').forEach((numStr) => {
          const n = parseInt(numStr.trim(), 10);
          if (!isNaN(n)) offMap[n] = true;
        });
      }
      setWeekOffs(offMap);
    } else {
      const today = new Date();
      const start = today.toISOString().split('T')[0];
      const end = new Date(today.setDate(today.getDate() + 13)).toISOString().split('T')[0];

      setName('');
      setGoal('');
      setStartDate(start);
      setEndDate(end);
      setHoursPerDay('8.0');
      setHoursPerSp('8.0');
      setWeekOffs({ 0: false, 1: false, 2: false, 3: false, 4: false, 5: true, 6: true });
      setDayOffs('');
      setStatus('active');
    }
  }, [isEdit, sprint, isOpen]);

  const toggleWeekOff = (dayNum) => {
    setWeekOffs((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter sprint name', 'error');
      return;
    }

    const selectedWeekOffs = Object.keys(weekOffs)
      .filter((k) => weekOffs[k])
      .join(',');

    try {
      setSubmitting(true);
      const payload = {
        name,
        goal,
        start_date: startDate,
        end_date: endDate,
        hours_per_sp: parseFloat(hoursPerSp),
        hours_per_day: parseFloat(hoursPerDay),
        week_offs: selectedWeekOffs,
        day_offs: dayOffs,
        status,
      };

      if (isEdit && sprint) {
        await API.updateSprint(sprint.id, payload);
        showToast('Sprint updated successfully!', 'success');
        onSprintSaved(sprint.id);
      } else {
        const res = await API.createSprint(payload);
        showToast(`Created new sprint: ${name}`, 'success');
        onSprintSaved(res.id);
      }
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={18} color="var(--accent-blue)" />
            <span>{isEdit ? 'Sprint Settings & Capacity' : 'Create New Sprint'}</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sprint Name */}
          <div className="form-group">
            <label className="form-label-text">Sprint Name *</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. Sprint 2: Real-Time Sync & Subtasks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Goal */}
          <div className="form-group">
            <label className="form-label-text">Sprint Goal</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="Core deliverable and focus..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label-text">Start Date *</label>
              <input
                type="date"
                className="form-input-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label-text">End Date *</label>
              <input
                type="date"
                className="form-input-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Ratios */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label-text">Workday Hours (1d = ? hrs)</label>
              <select
                className="form-input-control"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
              >
                <option value="8.0">1d = 8.0 Hours (Standard)</option>
                <option value="9.0">1d = 9.0 Hours</option>
                <option value="7.5">1d = 7.5 Hours</option>
                <option value="10.0">1d = 10.0 Hours</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label-text">Story Point Ratio (1 SP = ? hrs)</label>
              <select
                className="form-input-control"
                value={hoursPerSp}
                onChange={(e) => setHoursPerSp(e.target.value)}
              >
                <option value="8.0">1 SP = 8.0 Hours (Standard)</option>
                <option value="9.0">1 SP = 9.0 Hours</option>
                <option value="6.0">1 SP = 6.0 Hours</option>
                <option value="4.0">1 SP = 4.0 Hours</option>
              </select>
            </div>
          </div>

          {/* Week Offs Checkbox Group */}
          <div className="form-group">
            <label className="form-label-text">Weekly Days Off (Week Offs)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
              {dayNames.map((dName, idx) => (
                <label
                  key={idx}
                  style={{
                    background: weekOffs[idx] ? 'rgba(0, 113, 227, 0.12)' : 'var(--bg-surface-hover)',
                    border: `1px solid ${weekOffs[idx] ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 2px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: weekOffs[idx] ? 'var(--accent-blue)' : 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={weekOffs[idx]}
                    onChange={() => toggleWeekOff(idx)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{dName}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Holiday dates */}
          <div className="form-group">
            <label className="form-label-text">Specific Holidays / Off-Days (ISO dates, comma-separated)</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. 2026-09-18, 2026-09-25"
              value={dayOffs}
              onChange={(e) => setDayOffs(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label-text">Sprint Status</label>
            <select
              className="form-input-control"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Footer */}
          <div className="modal-footer-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Sprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
