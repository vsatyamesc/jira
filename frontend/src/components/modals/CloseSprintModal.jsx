import React, { useState } from 'react';
import { X, Flag, AlertCircle } from 'lucide-react';
import API from '../../api/client';

export default function CloseSprintModal({
  isOpen,
  onClose,
  sprints,
  activeSprint,
  tasks,
  onSprintClosed,
  showToast,
}) {
  if (!isOpen || !activeSprint) return null;

  const [moveToSprintId, setMoveToSprintId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const incompleteCount = tasks.length - doneCount;

  // Other non-closed sprints
  const candidateSprints = sprints.filter(
    (s) => s.id !== activeSprint.id && s.status !== 'closed'
  );

  const handleCloseSprint = async () => {
    try {
      setSubmitting(true);
      const targetSprint = moveToSprintId ? parseInt(moveToSprintId, 10) : null;
      await API.closeSprint(activeSprint.id, {
        move_incomplete_to: targetSprint,
      });
      showToast(`Sprint "${activeSprint.name}" closed!`, 'success');
      onSprintClosed();
      onClose();
    } catch (err) {
      showToast(`Failed to close sprint: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flag size={18} color="var(--accent-rose)" />
            <span>Complete & Close Sprint</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
          Are you sure you want to close <strong>{activeSprint.name}</strong>?
        </div>

        {/* Incomplete tasks summary box */}
        <div
          style={{
            background: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem',
            fontSize: '0.825rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <strong>{doneCount}</strong> completed task(s).
          </div>
          <div style={{ color: 'var(--accent-amber)', marginTop: '4px' }}>
            <strong>{incompleteCount}</strong> incomplete task(s) remaining.
          </div>
        </div>

        {/* Move incomplete tasks target */}
        <div className="form-group">
          <label className="form-label-text">Move Incomplete Tasks To:</label>
          <select
            className="form-input-control"
            value={moveToSprintId}
            onChange={(e) => setMoveToSprintId(e.target.value)}
          >
            <option value="">Backlog (No Sprint)</option>
            {candidateSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
        </div>

        <div className="modal-footer-row">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleCloseSprint}
            disabled={submitting}
          >
            {submitting ? 'Closing...' : 'Complete & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
