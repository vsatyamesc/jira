import React from 'react';
import { X, Clock, Trash2, Plus } from 'lucide-react';

export default function CellSlotsModal({
  cellInfo,
  onClose,
  onDeleteSlot,
  onAddMoreSlot,
}) {
  if (!cellInfo) return null;

  const { task, date, slots = [] } = cellInfo;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {date}
            </div>
            <div className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="task-key-badge">{task.key}</span>
              <span>{task.title}</span>
            </div>
          </div>

          <button className="modal-close-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Logged Sessions ({slots.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
            {slots.map((s) => (
              <div
                key={s.id}
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="task-key-badge" style={{ fontSize: '0.65rem' }}>{s.key}</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {s.start_time} – {s.end_time} ({s.duration_hours}h)
                    </span>
                    {s.is_subtask && (
                      <span className="brand-tag" style={{ fontSize: '0.62rem', background: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent-blue)' }}>
                        Subtask
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {s.title}
                  </div>
                  {s.notes && (
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {s.notes}
                    </div>
                  )}
                </div>

                <button
                  className="btn-danger btn btn-sm"
                  onClick={() => onDeleteSlot(s.id)}
                  title="Remove this slot"
                  style={{ padding: '4px 8px' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {slots.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '1.5rem', fontSize: '0.8rem' }}>
                No slots logged for this cell.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer-row">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onAddMoreSlot(task.id, date);
            }}
          >
            <Plus size={13} /> Add Slot
          </button>
        </div>
      </div>
    </div>
  );
}
