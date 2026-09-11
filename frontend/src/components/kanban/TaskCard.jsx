import React, { useState } from 'react';
import { Clock, Plus, Trash2, Edit3, CheckSquare, User } from 'lucide-react';

export default function TaskCard({
  task,
  onOpenTimeSlotModal,
  onOpenSubtaskModal,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
}) {
  const pct = Math.min(100, task.percent_spent || 0);
  const isCompleted = task.status === 'done' || pct >= 100;
  const isOverbudget = pct > 100;

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="task-card"
      draggable
      onDragStart={handleDragStart}
      style={{ '--card-accent': task.color || '#0071e3' }}
    >
      {/* Header */}
      <div className="task-card-header">
        <span className="task-key-badge">{task.key}</span>
        <span className={`priority-chip priority-${task.priority || 'medium'}`}>
          {task.priority || 'medium'}
        </span>
      </div>

      {/* Title */}
      <div className="task-card-title">{task.title}</div>
      {task.description && <div className="task-card-desc">{task.description}</div>}

      {/* Budget & Logged Progress */}
      <div className="card-budget-box">
        <div className="card-budget-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, color: 'var(--text-main)' }}>
            ⚡ {task.story_points} SP
            <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>
              ({task.budgeted_hours}h{task.allocated_jira_str ? ` / ${task.allocated_jira_str}` : ''})
            </span>
          </span>
          <span style={{ color: isOverbudget ? 'var(--accent-rose)' : 'var(--accent-blue)', fontWeight: 600 }}>
            {task.logged_hours}h ({pct}%)
          </span>
        </div>

        <div className="card-progress-track">
          <div
            className={`card-progress-fill ${isOverbudget ? 'overbudget' : isCompleted ? 'completed' : ''}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {/* Subtasks Section */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="subtasks-box">
          <div className="subtasks-header">
            <span>
              Subtasks ({task.subtasks_done_count || 0}/{task.subtasks_count || task.subtasks.length})
            </span>
            <button
              className="card-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSubtaskModal(task.id, task.key);
              }}
              title="Add Subtask"
            >
              <Plus size={11} /> Subtask
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {task.subtasks.map((st) => (
              <div
                key={st.id}
                className={`subtask-item ${st.status === 'done' ? 'done' : ''}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}>
                  <input
                    type="checkbox"
                    className="subtask-checkbox"
                    checked={st.status === 'done'}
                    onChange={() => onToggleSubtask(st.id)}
                  />
                  <span
                    className="task-key-badge"
                    style={{ fontSize: '0.62rem', padding: '1px 4px', flexShrink: 0 }}
                    title={st.key}
                  >
                    {st.key}
                  </span>
                  <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {st.title}
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: st.sub_logged_hours > 0 ? 'var(--accent-emerald)' : 'var(--text-faint)' }}>
                    {st.sub_logged_hours || 0}h{st.allocated_hours ? `/${st.allocated_hours}h` : ''}
                  </span>
                  <button
                    className="card-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTimeSlotModal(st.id);
                    }}
                    title={`Log time to subtask ${st.key} (rolls up to ${task.key})`}
                    style={{ padding: '1px 4px' }}
                  >
                    <Clock size={10} color="var(--accent-blue)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="card-actions-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-faint)' }}>
          <User size={11} /> {task.assignee || 'Me'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {(!task.subtasks || task.subtasks.length === 0) && (
            <button
              className="card-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSubtaskModal(task.id, task.key);
              }}
              title="Add Subtask"
            >
              <Plus size={11} />
            </button>
          )}

          <button
            className="card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTimeSlotModal(task.id);
            }}
            title="Log Time Slot"
          >
            <Clock size={11} /> Slot
          </button>

          <button
            className="card-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEditTask(task);
            }}
            title="Edit Task"
          >
            <Edit3 size={11} />
          </button>

          <button
            className="card-action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            title="Delete Task"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
