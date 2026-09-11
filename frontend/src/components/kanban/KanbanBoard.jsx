import React from 'react';
import KanbanColumn from './KanbanColumn';

export default function KanbanBoard({
  tasks,
  onDropTask,
  onOpenTimeSlotModal,
  onOpenSubtaskModal,
  onToggleSubtask,
  onEditTask,
  onDeleteTask,
}) {
  const columns = [
    { status: 'todo', title: 'To Do' },
    { status: 'in_progress', title: 'In Progress' },
    { status: 'in_review', title: 'In Review' },
    { status: 'done', title: 'Done' },
  ];

  return (
    <div className="kanban-grid">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => (t.status || 'todo') === col.status);
        return (
          <KanbanColumn
            key={col.status}
            status={col.status}
            title={col.title}
            tasks={colTasks}
            onDropTask={onDropTask}
            onOpenTimeSlotModal={onOpenTimeSlotModal}
            onOpenSubtaskModal={onOpenSubtaskModal}
            onToggleSubtask={onToggleSubtask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        );
      })}
    </div>
  );
}
