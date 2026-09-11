import React from 'react';
import { Target, Settings, Plus, Clock, Sun, Moon, CheckSquare } from 'lucide-react';

export default function Navbar({
  activeSprint,
  onOpenSprintSelector,
  onOpenSettingsModal,
  onOpenCreateTaskModal,
  onOpenTimeSlotModal,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="top-navbar">
      {/* Brand */}
      <div className="brand-section">
        <div className="brand-icon">CJ</div>
        <div>
          <div className="brand-title">
            ChronoJira
            <span className="brand-tag">Visual Agile</span>
          </div>
        </div>
      </div>

      {/* Sleek Apple Menu Strip */}
      <div className="nav-actions">
        {/* Sprint Button with Active Sprint indicator */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenSprintSelector}
          title="Open Sprint Switcher & Overview"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Target size={14} color="var(--accent-blue)" />
          <span>{activeSprint ? activeSprint.name : 'Sprint'}</span>
          {activeSprint && (
            <span
              className="brand-tag"
              style={{
                fontSize: '0.65rem',
                background: 'rgba(0, 113, 227, 0.12)',
                color: 'var(--accent-blue)',
                marginLeft: '2px',
              }}
            >
              {activeSprint.status === 'active' ? 'Active' : activeSprint.status}
            </span>
          )}
        </button>

        {/* Settings Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenSettingsModal}
          title="Sprint Settings & Week Offs"
        >
          <Settings size={14} />
          <span>Settings</span>
        </button>

        {/* New Task Button */}
        <button className="btn btn-secondary btn-sm" onClick={onOpenCreateTaskModal}>
          <CheckSquare size={14} />
          <span>New Task</span>
        </button>

        {/* Log Time Button */}
        <button className="btn btn-primary btn-sm" onClick={() => onOpenTimeSlotModal()}>
          <Clock size={14} />
          <span>Log Time</span>
        </button>

        {/* Theme Toggle (☀️ / 🌙) */}
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Apple Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={17} style={{ color: '#ffd60a' }} />
          ) : (
            <Moon size={17} style={{ color: '#0071e3' }} />
          )}
        </button>
      </div>
    </header>
  );
}
