import React, { useState } from 'react';
import TaskCard from './TaskCard';

export default function KanbanColumn({
  status,
  title,
  tasks,
  onDropTask,
  onOpenTimeSlotModal,
  onOpenSubtaskModal,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (taskIdStr) {
      onDropTask(parseInt(taskIdStr, 10), status);
    }
  };

  return (
    <div
      className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-header">
        <div className="column-title-group">
          <span className={`column-dot ${status}`} />
          <span className="column-title">{title}</span>
        </div>
        <span className="column-count-badge">{tasks.length}</span>
      </div>

      <div className="column-cards-list">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpenTimeSlotModal={onOpenTimeSlotModal}
            onOpenSubtaskModal={onOpenSubtaskModal}
            onToggleSubtask={onToggleSubtask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: '0.78rem',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
}
