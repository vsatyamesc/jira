import React from 'react';
import { X, Target, Calendar, CheckCircle2, Clock, Plus, Settings, Flag } from 'lucide-react';

export default function SprintSelectorModal({
  isOpen,
  onClose,
  sprints,
  activeSprint,
  onSelectSprint,
  onOpenManageSprintModal,
  onOpenCloseSprintModal,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={20} color="var(--accent-blue)" />
            <span>Sprints</span>
          </div>
          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Current Active Sprint Overview Card */}
        {activeSprint && (
          <div
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="brand-tag" style={{ background: 'rgba(0, 113, 227, 0.15)', color: 'var(--accent-blue)' }}>
                  Active Sprint
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{activeSprint.name}</span>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose();
                    onOpenManageSprintModal(true);
                  }}
                  title="Sprint Settings"
                >
                  <Settings size={12} /> Settings
                </button>

                {activeSprint.status === 'active' && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      onClose();
                      onOpenCloseSprintModal();
                    }}
                    title="Complete & Close Sprint"
                  >
                    <Flag size={12} /> Close
                  </button>
                )}
              </div>
            </div>

            {activeSprint.goal && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                {activeSprint.goal}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
              <span>📅 {activeSprint.start_date} – {activeSprint.end_date}</span>
              <span>⚡ {activeSprint.total_story_points} SP ({activeSprint.budgeted_hours}h)</span>
              <span>⏱️ {activeSprint.logged_hours}h logged</span>
            </div>

            {/* Burn-up mini bar */}
            <div className="progress-track" style={{ height: '6px', marginTop: '4px' }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, activeSprint.progress_percentage || 0)}%` }}
              />
            </div>
          </div>
        )}

        {/* All Sprints List */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            All Sprints ({sprints.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
            {sprints.map((s) => {
              const isCurrent = activeSprint && activeSprint.id === s.id;
              const statusBadge =
                s.status === 'active'
                  ? '⚡ Active'
                  : s.status === 'closed'
                  ? '🔒 Closed'
                  : '📅 Planned';

              return (
                <div
                  key={s.id}
                  style={{
                    background: isCurrent ? 'rgba(0, 113, 227, 0.08)' : 'var(--bg-surface-solid)',
                    border: `1px solid ${isCurrent ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.name}</span>
                      <span className="brand-tag" style={{ fontSize: '0.65rem' }}>
                        {statusBadge}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {s.start_date} – {s.end_date} • {s.total_story_points || 0} SP • {s.logged_hours || 0}h logged
                    </div>
                  </div>

                  {isCurrent ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={13} /> Selected
                    </span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        onSelectSprint(s.id);
                        onClose();
                      }}
                    >
                      Switch
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-footer-row" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onOpenManageSprintModal(false);
            }}
          >
            <Plus size={13} /> Create New Sprint
          </button>

          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
