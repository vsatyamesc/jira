import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import SprintStats from './components/SprintStats';
import TabNavigation from './components/TabNavigation';
import ToastContainer from './components/Toast';
import KanbanBoard from './components/kanban/KanbanBoard';
import ScheduleView from './components/schedule/ScheduleView';
import TimesheetMatrix from './components/timesheet/TimesheetMatrix';
import AnalyticsView from './components/analytics/AnalyticsView';

import LogTimeSlotModal from './components/modals/LogTimeSlotModal';
import CreateTaskModal from './components/modals/CreateTaskModal';
import CreateSubtaskModal from './components/modals/CreateSubtaskModal';
import ManageSprintModal from './components/modals/ManageSprintModal';
import CloseSprintModal from './components/modals/CloseSprintModal';
import SprintSelectorModal from './components/modals/SprintSelectorModal';

import API from './api/client';

export default function App() {
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chronojira_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chronojira_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Application data state
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentTab, setCurrentTab] = useState('kanban');
  const [loading, setLoading] = useState(true);

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modals state
  const [sprintSelectorOpen, setSprintSelectorOpen] = useState(false);

  const [timeSlotModal, setTimeSlotModal] = useState({
    isOpen: false,
    taskId: null,
    initialData: null,
  });

  const [taskModal, setTaskModal] = useState({
    isOpen: false,
    editTask: null,
  });

  const [subtaskModal, setSubtaskModal] = useState({
    isOpen: false,
    parentId: null,
    parentKey: '',
  });

  const [sprintModal, setSprintModal] = useState({
    isOpen: false,
    isEdit: false,
  });

  const [closeSprintModalOpen, setCloseSprintModalOpen] = useState(false);

  // Reload all application data
  const reloadAll = useCallback(async (targetSprintId = null) => {
    try {
      setLoading(true);
      const sprintList = await API.getSprints();
      setSprints(sprintList);

      let curSprint = null;
      if (targetSprintId) {
        curSprint = await API.getActiveSprint(targetSprintId);
      } else {
        curSprint = await API.getActiveSprint();
      }
      setActiveSprint(curSprint);

      if (curSprint) {
        const taskList = await API.getTasks(curSprint.id);
        setTasks(taskList);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Sprint selection handler
  const handleSelectSprint = async (sprintId) => {
    await reloadAll(sprintId);
    showToast('Switched sprint', 'success');
  };

  // Kanban task status drop
  const handleDropTask = async (taskId, newStatus) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      await API.updateTask(taskId, { status: newStatus });
      showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, 'error');
      reloadAll(activeSprint?.id);
    }
  };

  // Subtask checkbox toggle
  const handleToggleSubtask = async (subtaskId) => {
    try {
      const res = await API.toggleSubtask(subtaskId);
      showToast(`Subtask marked ${res.status}`, 'success');
      reloadAll(activeSprint?.id);
    } catch (err) {
      showToast(`Failed to toggle subtask: ${err.message}`, 'error');
    }
  };

  // Task deletion
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await API.deleteTask(taskId);
      showToast('Task deleted successfully', 'success');
      reloadAll(activeSprint?.id);
    } catch (err) {
      showToast(`Failed to delete task: ${err.message}`, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Subtle Ambient Glow */}
      <div className="ambient-glow" />

      {/* Top Navbar with sleek strip menu */}
      <Navbar
        activeSprint={activeSprint}
        onOpenSprintSelector={() => setSprintSelectorOpen(true)}
        onOpenSettingsModal={() => setSprintModal({ isOpen: true, isEdit: true })}
        onOpenCreateTaskModal={() => setTaskModal({ isOpen: true, editTask: null })}
        onOpenTimeSlotModal={(taskId, initialData) =>
          setTimeSlotModal({ isOpen: true, taskId, initialData })
        }
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Compact Capacity & Sprint Burn-Up Ribbon */}
      <SprintStats activeSprint={activeSprint} />

      {/* Segmented Tab Navigation */}
      <TabNavigation currentTab={currentTab} onChangeTab={setCurrentTab} />

      {/* Main Tab Content */}
      <main style={{ minHeight: '520px' }}>
        {currentTab === 'kanban' && (
          <KanbanBoard
            tasks={tasks}
            onDropTask={handleDropTask}
            onOpenTimeSlotModal={(taskId) =>
              setTimeSlotModal({ isOpen: true, taskId, initialData: null })
            }
            onOpenSubtaskModal={(parentId, parentKey) =>
              setSubtaskModal({ isOpen: true, parentId, parentKey })
            }
            onToggleSubtask={handleToggleSubtask}
            onEditTask={(task) => setTaskModal({ isOpen: true, editTask: task })}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {currentTab === 'schedule' && (
          <ScheduleView
            activeSprint={activeSprint}
            onOpenTimeSlotModal={(taskId, initialData) =>
              setTimeSlotModal({ isOpen: true, taskId, initialData })
            }
            showToast={showToast}
          />
        )}

        {currentTab === 'timesheet' && (
          <TimesheetMatrix
            activeSprint={activeSprint}
            onOpenTimeSlotModal={(taskId, initialData) =>
              setTimeSlotModal({ isOpen: true, taskId, initialData })
            }
            showToast={showToast}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            tasks={tasks}
            activeSprint={activeSprint}
            onSprintUpdated={() => reloadAll(activeSprint?.id)}
            showToast={showToast}
          />
        )}
      </main>

      {/* Sprints Selector Dialog */}
      <SprintSelectorModal
        isOpen={sprintSelectorOpen}
        onClose={() => setSprintSelectorOpen(false)}
        sprints={sprints}
        activeSprint={activeSprint}
        onSelectSprint={handleSelectSprint}
        onOpenManageSprintModal={(isEdit) => setSprintModal({ isOpen: true, isEdit })}
        onOpenCloseSprintModal={() => setCloseSprintModalOpen(true)}
      />

      {/* Log Time Slot Modal */}
      <LogTimeSlotModal
        isOpen={timeSlotModal.isOpen}
        onClose={() => setTimeSlotModal({ isOpen: false, taskId: null, initialData: null })}
        tasks={tasks}
        activeSprint={activeSprint}
        initialTaskId={timeSlotModal.taskId}
        initialData={timeSlotModal.initialData}
        onSlotCreated={() => reloadAll(activeSprint?.id)}
        showToast={showToast}
      />

      {/* Create / Edit Task Modal */}
      <CreateTaskModal
        isOpen={taskModal.isOpen}
        onClose={() => setTaskModal({ isOpen: false, editTask: null })}
        activeSprint={activeSprint}
        editTask={taskModal.editTask}
        onTaskSaved={() => reloadAll(activeSprint?.id)}
        showToast={showToast}
      />

      {/* Create Subtask Modal */}
      <CreateSubtaskModal
        isOpen={subtaskModal.isOpen}
        onClose={() => setSubtaskModal({ isOpen: false, parentId: null, parentKey: '' })}
        parentId={subtaskModal.parentId}
        parentKey={subtaskModal.parentKey}
        onSubtaskCreated={() => reloadAll(activeSprint?.id)}
        showToast={showToast}
      />

      {/* Manage Sprint Settings Modal */}
      <ManageSprintModal
        isOpen={sprintModal.isOpen}
        onClose={() => setSprintModal({ isOpen: false, isEdit: false })}
        isEdit={sprintModal.isEdit}
        sprint={activeSprint}
        onSprintSaved={(sprintId) => reloadAll(sprintId)}
        showToast={showToast}
      />

      {/* Complete & Close Sprint Modal */}
      <CloseSprintModal
        isOpen={closeSprintModalOpen}
        onClose={() => setCloseSprintModalOpen(false)}
        sprints={sprints}
        activeSprint={activeSprint}
        tasks={tasks}
        onSprintClosed={() => reloadAll()}
        showToast={showToast}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
