import React, { useState } from 'react';
import { X, CornerDownRight } from 'lucide-react';
import API from '../../api/client';

export default function CreateSubtaskModal({
  isOpen,
  onClose,
  parentId,
  parentKey,
  onSubtaskCreated,
  showToast,
}) {
  if (!isOpen || !parentId) return null;

  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [allocatedTimeStr, setAllocatedTimeStr] = useState('');
  const [assignee, setAssignee] = useState('Me');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter subtask title', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.createSubtask(parentId, {
        key: key.trim() || undefined,
        title,
        allocated_time_str: allocatedTimeStr,
        assignee,
      });
      showToast(`Subtask ${res.key} added under ${parentKey}!`, 'success');
      onSubtaskCreated();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CornerDownRight size={18} color="var(--accent-blue)" />
            <span>Add Subtask under </span>
            <span className="task-key-badge">{parentKey}</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Custom Subtask Ticket Key */}
          <div className="form-group">
            <label className="form-label-text">
              Subtask Ticket Key (Optional — e.g. {parentKey}-1, {parentKey}-SUB)
            </label>
            <input
              type="text"
              className="form-input-control"
              placeholder={`Default: ${parentKey}-n`}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              Leave blank to auto-generate based on parent ticket key.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label-text">Subtask Title *</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. Write integration test suite"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label-text">Allocated Time (e.g. 4h, 0.5d, 2h 30m)</label>
              <input
                type="text"
                className="form-input-control"
                placeholder="e.g. 4h, 1d"
                value={allocatedTimeStr}
                onChange={(e) => setAllocatedTimeStr(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label-text">Assignee</label>
              <input
                type="text"
                className="form-input-control"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Subtask'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
