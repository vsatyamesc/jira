import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';
import API from '../../api/client';
import {
  parseDurationClient,
  formatJiraDurationClient,
  timeToMinutes,
  minutesToTime,
  roundTwo,
  assignTracks,
} from '../../utils/timeUtils';

export default function LogTimeSlotModal({
  isOpen,
  onClose,
  tasks,
  activeSprint,
  initialTaskId,
  initialData,
  onSlotCreated,
  showToast,
}) {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const hoursPerDay = activeSprint ? (activeSprint.hours_per_day || 8.0) : 8.0;

  const [taskId, setTaskId] = useState(initialTaskId || (tasks[0]?.id || ''));
  const [date, setDate] = useState(initialData?.date || todayStr);
  const [startTime, setStartTime] = useState(initialData?.start_time || '09:00');
  const [endTime, setEndTime] = useState(initialData?.end_time || '11:00');
  const [durationStr, setDurationStr] = useState('');
  const [notes, setNotes] = useState('');
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [existingSlots, setExistingSlots] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing slots for visual preview & collision checking on date change
  const fetchDaySlots = async (dStr) => {
    try {
      const slots = await API.getTimeSlots(dStr);
      setExistingSlots(slots);
    } catch (_) {}
  };

  useEffect(() => {
    if (date) {
      fetchDaySlots(date);
    }
  }, [date]);

  // Compute live conflicts whenever date, startTime, or endTime change
  useEffect(() => {
    if (!startTime || !endTime || !date) {
      setConflicts([]);
      return;
    }

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    if (newEnd <= newStart) {
      setConflicts([]);
      return;
    }

    const confs = existingSlots.filter((s) => {
      const currStart = timeToMinutes(s.start_time);
      const currEnd = timeToMinutes(s.end_time);
      return newStart < currEnd && newEnd > currStart;
    });

    setConflicts(confs);
  }, [startTime, endTime, existingSlots, date]);

  // Calculate duration in hours
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const durationHours = endMin > startMin ? roundTwo((endMin - startMin) / 60.0) : 0;

  // Handler for regex duration input
  const handleDurationStrChange = (val) => {
    setDurationStr(val);
    const parsed = parseDurationClient(val, hoursPerDay);
    if (parsed && parsed > 0) {
      const sMin = timeToMinutes(startTime);
      const eMin = sMin + Math.round(parsed * 60);
      setEndTime(minutesToTime(eMin));
    }
  };

  // Handler for start time change
  const handleStartTimeChange = (val) => {
    setStartTime(val);
    if (durationStr.trim()) {
      const parsed = parseDurationClient(durationStr, hoursPerDay);
      if (parsed && parsed > 0) {
        const sMin = timeToMinutes(val);
        const eMin = sMin + Math.round(parsed * 60);
        setEndTime(minutesToTime(eMin));
      }
    }
  };

  // Handler for end time change
  const handleEndTimeChange = (val) => {
    setEndTime(val);
    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(val);
    if (eMin > sMin) {
      const dur = (eMin - sMin) / 60.0;
      setDurationStr(formatJiraDurationClient(dur, hoursPerDay));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!taskId) {
      showToast('Please select a task', 'error');
      return;
    }
    if (endMin <= startMin) {
      showToast('End time must be after start time', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.createTimeSlot({
        task_id: parseInt(taskId, 10),
        date,
        start_time: startTime,
        end_time: endTime,
        notes,
        allow_overlap: allowOverlap,
      });

      showToast(res.message || 'Time slot saved successfully!', 'success');
      onSlotCreated();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const WORK_START = 8 * 60;
  const WORK_SPAN = 12 * 60;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={18} color="var(--accent-blue)" />
            <span>Log Time Slot</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Work item selection (Parents + Subtasks) */}
          <div className="form-group">
            <label className="form-label-text">Work Item / Task or Subtask *</label>
            <select
              className="form-input-control"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              required
            >
              <option value="">-- Choose Task or Subtask --</option>
              {tasks.map((t) => (
                <React.Fragment key={t.id}>
                  <option value={t.id} style={{ fontWeight: 700 }}>
                    [{t.key}] {t.title} ({t.story_points} SP, {t.logged_hours}h / {t.budgeted_hours}h)
                  </option>
                  {t.subtasks && t.subtasks.map((st) => (
                    <option key={st.id} value={st.id} style={{ color: 'var(--accent-blue)' }}>
                      &nbsp;&nbsp;&nbsp;↳ [{st.key}] {st.title} (Subtask • {st.sub_logged_hours || 0}h logged)
                    </option>
                  ))}
                </React.Fragment>
              ))}
            </select>

            {/* Subtask Rollup Indicator */}
            {(() => {
              let parentFound = null;
              let subFound = null;
              const numericId = parseInt(taskId, 10);
              for (const p of tasks) {
                if (p.subtasks) {
                  const s = p.subtasks.find((sub) => sub.id === numericId);
                  if (s) {
                    parentFound = p;
                    subFound = s;
                    break;
                  }
                }
              }
              if (subFound && parentFound) {
                return (
                  <div
                    style={{
                      fontSize: '0.725rem',
                      color: 'var(--accent-blue)',
                      background: 'rgba(0, 113, 227, 0.08)',
                      border: '1px solid rgba(0, 113, 227, 0.2)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      marginTop: '4px',
                    }}
                  >
                    ↳ Subtask of <strong>{parentFound.key}</strong> — Time logged here will automatically roll up to {parentFound.key}.
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Date Picker */}
          <div className="form-group">
            <label className="form-label-text">Date *</label>
            <input
              type="date"
              className="form-input-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Visual Day Occupancy Preview */}
          <div className="form-group">
            <label className="form-label-text">Existing Booked Slots on this Day (08:00 – 20:00)</label>
            <div
              style={{
                position: 'relative',
                height: '28px',
                background: 'var(--bg-surface-hover)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              {assignTracks(existingSlots).map((s) => {
                const sStart = Math.max(WORK_START, s._startM);
                const sEnd = Math.min(WORK_START + WORK_SPAN, s._endM);
                if (sEnd <= sStart) return null;
                const left = ((sStart - WORK_START) / WORK_SPAN) * 100;
                const width = Math.max(1, ((sEnd - sStart) / WORK_SPAN) * 100);
                const top = s.totalTracks > 1 ? (s.trackIndex * (100 / s.totalTracks)) : 0;
                const height = s.totalTracks > 1 ? (100 / s.totalTracks) : 100;
                return (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: `${top}%`,
                      height: `${height}%`,
                      background: s.color || '#0071e3',
                      border: s.isColliding ? '1px solid var(--accent-amber)' : 'none',
                      opacity: 0.85,
                      boxSizing: 'border-box',
                    }}
                    title={`${s.key} (${s.start_time}-${s.end_time})${s.isColliding ? ' [Overlap Conflict]' : ''}`}
                  />
                );
              })}

              {/* Proposed slot preview in striped pattern or highlight */}
              {endMin > startMin && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.max(0, ((startMin - WORK_START) / WORK_SPAN) * 100)}%`,
                    width: `${Math.min(100, ((endMin - startMin) / WORK_SPAN) * 100)}%`,
                    height: '100%',
                    background: conflicts.length > 0 ? 'rgba(255, 59, 48, 0.5)' : 'rgba(52, 199, 89, 0.5)',
                    border: '1px solid currentColor',
                    boxSizing: 'border-box',
                  }}
                  title="New slot preview"
                />
              )}
            </div>
          </div>

          {/* Regex Duration Input */}
          <div className="form-group">
            <label className="form-label-text">
              Quick Duration (Regex: e.g. 1d, 1d 2h, 30m, 1.5h, 45m, 1w)
            </label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. 1d 2h, 30m, 1.5h"
              value={durationStr}
              onChange={(e) => handleDurationStrChange(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-blue)' }}
            />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
              Automatically adjusts end time based on 1d = {hoursPerDay}h
            </span>
          </div>

          {/* Start & End Times */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label-text">Start Time *</label>
              <input
                type="time"
                className="form-input-control"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                step="900"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label-text">End Time *</label>
              <input
                type="time"
                className="form-input-control"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                step="900"
                required
              />
            </div>
          </div>

          {/* Duration display */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '0.85rem' }}>
            ⏱️ Duration: {durationHours} Hours
          </div>

          {/* Live Collision Warning Box */}
          {conflicts.length > 0 && (
            <div className="collision-alert-banner">
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <AlertTriangle size={14} /> Overlap Warning: Time collision detected!
              </div>
              <div>
                Overlaps with: {conflicts.map((c) => `${c.key} (${c.start_time} - ${c.end_time})`).join(', ')}
              </div>
            </div>
          )}

          {/* Session Notes */}
          <div className="form-group">
            <label className="form-label-text">Session Notes / Description</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. Implemented modal sheets and collision inspector"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Allow Overlap Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
            <input
              type="checkbox"
              id="slot-allow-overlap"
              checked={allowOverlap}
              onChange={(e) => setAllowOverlap(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="slot-allow-overlap" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Allow Overlap (force booking even if colliding with another slot)
            </label>
          </div>

          {/* Footer */}
          <div className="modal-footer-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Time Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
