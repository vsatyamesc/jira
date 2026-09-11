import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Palette, Check } from 'lucide-react';
import API from '../../api/client';

export default function CreateTaskModal({
  isOpen,
  onClose,
  activeSprint,
  editTask,
  onTaskSaved,
  showToast,
}) {
  if (!isOpen) return null;

  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [storyPoints, setStoryPoints] = useState('1.0');
  const [allocatedTimeStr, setAllocatedTimeStr] = useState('');
  const [priority, setPriority] = useState('medium');
  const [color, setColor] = useState('#0071e3');
  const [assignee, setAssignee] = useState('Me');
  const [submitting, setSubmitting] = useState(false);

  // Predefined Apple palette accents
  const colorPresets = [
    { name: 'System Blue', hex: '#0071e3' },
    { name: 'Teal Cyan', hex: '#00c7be' },
    { name: 'Apple Green', hex: '#34c759' },
    { name: 'Amber Yellow', hex: '#ffcc00' },
    { name: 'Orange', hex: '#ff9500' },
    { name: 'Rose Red', hex: '#ff3b30' },
    { name: 'Pink', hex: '#ff2d55' },
    { name: 'Purple', hex: '#af52de' },
    { name: 'Indigo', hex: '#5856d6' },
    { name: 'Graphite', hex: '#8e8e93' },
  ];

  useEffect(() => {
    if (editTask) {
      setKey(editTask.key || '');
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setStoryPoints(String(editTask.story_points || 1.0));
      setAllocatedTimeStr(editTask.allocated_jira_str || '');
      setPriority(editTask.priority || 'medium');
      setColor(editTask.color || '#0071e3');
      setAssignee(editTask.assignee || 'Me');
    } else {
      setKey('');
      setTitle('');
      setDescription('');
      setStoryPoints('1.0');
      setAllocatedTimeStr('');
      setPriority('medium');
      setColor('#0071e3');
      setAssignee('Me');
    }
  }, [editTask, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a task title', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editTask) {
        await API.updateTask(editTask.id, {
          key: key.trim() || undefined,
          title,
          description,
          story_points: parseFloat(storyPoints),
          allocated_time_str: allocatedTimeStr,
          priority,
          color,
          assignee,
        });
        showToast(`Task updated successfully!`, 'success');
      } else {
        const sprintId = activeSprint ? activeSprint.id : null;
        await API.createTask({
          key: key.trim() || undefined,
          title,
          description,
          sprint_id: sprintId,
          story_points: parseFloat(storyPoints),
          allocated_time_str: allocatedTimeStr,
          priority,
          color,
          assignee,
        });
        showToast('Task created successfully!', 'success');
      }

      onTaskSaved();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const hoursPerSp = activeSprint ? (activeSprint.hours_per_sp || 8.0) : 8.0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckSquare size={18} color="var(--accent-blue)" />
            <span>{editTask ? `Edit Task ${editTask.key}` : 'Create New Task'}</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Custom Ticket Key Input */}
          <div className="form-group">
            <label className="form-label-text">
              Ticket Key (Optional — Match workplace Jira, e.g. ENG-402, PROJ-101)
            </label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. PROJ-123 (Leave blank for default CJ-xxx)"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              If left blank, ChronoJira automatically assigns the next sequential CJ-xxx key.
            </span>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label-text">Task Title *</label>
            <input
              type="text"
              className="form-input-control"
              placeholder="e.g. Implement real-time sync with workplace Jira"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label-text">Description</label>
            <textarea
              className="form-input-control"
              rows={2}
              placeholder="Key deliverables, acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Story Points and Allocated Time */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label-text">Story Points *</label>
              <select
                className="form-input-control"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
              >
                <option value="1.0">1 SP ({1 * hoursPerSp} Hours)</option>
                <option value="2.0">2 SP ({2 * hoursPerSp} Hours)</option>
                <option value="3.0">3 SP ({3 * hoursPerSp} Hours)</option>
                <option value="5.0">5 SP ({5 * hoursPerSp} Hours)</option>
                <option value="8.0">8 SP ({8 * hoursPerSp} Hours)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label-text">Allocated Time (Optional)</label>
              <input
                type="text"
                className="form-input-control"
                placeholder="e.g. 2d 4h, 16h, 1.5d"
                value={allocatedTimeStr}
                onChange={(e) => setAllocatedTimeStr(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="form-group">
            <label className="form-label-text">Priority</label>
            <select
              className="form-input-control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Color Accent Picker: Visual Swatches + Custom Picker */}
          <div className="form-group">
            <label className="form-label-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Color Accent Tag</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: color }}>
                {color}
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {colorPresets.map((p) => {
                const isSelected = color.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => setColor(p.hex)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: p.hex,
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: isSelected ? `0 0 0 2px ${p.hex}` : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    }}
                    title={p.name}
                  >
                    {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                  </button>
                );
              })}

              {/* Native Color Picker for ANY Custom Color */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px dashed var(--border-medium)',
                  background: 'var(--bg-surface-hover)',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                }}
                title="Select Any Custom Color"
              >
                <Palette size={13} />
                <span>Custom</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    opacity: 0,
                    width: '0px',
                    height: '0px',
                    position: 'absolute',
                    pointerEvents: 'none',
                  }}
                />
              </label>
            </div>

            {/* Live Visual Card Preview */}
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'var(--bg-surface-solid)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `4px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="task-key-badge" style={{ color: color, background: `${color}18` }}>
                {key.trim() || 'CJ-PREVIEW'}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {title.trim() || 'Sample Task Title'}
              </span>
            </div>
          </div>

          {/* Assignee */}
          <div className="form-group">
            <label className="form-label-text">Assignee</label>
            <input
              type="text"
              className="form-input-control"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="modal-footer-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Saving...' : editTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
