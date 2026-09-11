import React from 'react';
import { TrendingUp, Clock, Zap } from 'lucide-react';

export default function SprintStats({ activeSprint }) {
  if (!activeSprint) return null;

  const totalSp = activeSprint.total_story_points || 0;
  const hoursPerSp = activeSprint.hours_per_sp || 8.0;
  const hoursPerDay = activeSprint.hours_per_day || 8.0;
  const budgeted = activeSprint.budgeted_hours || 0;
  const logged = activeSprint.logged_hours || 0;
  const remaining = activeSprint.remaining_hours || 0;
  const progressPct = activeSprint.progress_percentage || 0;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.65rem 1.1rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}
    >
      {/* Left: Sprint Context & Ratios */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {activeSprint.name}
        </span>

        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-surface-hover)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {activeSprint.start_date} – {activeSprint.end_date}
        </span>

        <span
          className="stat-badge-pill"
          style={{ background: 'rgba(0, 113, 227, 0.1)', color: 'var(--accent-blue)' }}
        >
          ⚡ {totalSp} SP (1 SP = {hoursPerSp}h)
        </span>

        <span
          className="stat-badge-pill"
          style={{ background: 'rgba(0, 199, 190, 0.1)', color: 'var(--accent-cyan)' }}
        >
          1d = {hoursPerDay}h
        </span>
      </div>

      {/* Right: Consolidated Burn-up & Time spent */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
          <span>
            Logged: <strong style={{ color: 'var(--accent-emerald)' }}>{logged}h</strong>
          </span>
          <span style={{ color: 'var(--text-faint)' }}>/</span>
          <span style={{ color: 'var(--text-muted)' }}>
            Budget: <strong>{budgeted}h</strong>
          </span>
          <span style={{ color: 'var(--text-faint)' }}>•</span>
          <span style={{ color: 'var(--accent-amber)' }}>
            <strong>{remaining}h</strong> left
          </span>
        </div>

        {/* Inline Burn-up Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
          <div className="progress-track" style={{ flex: 1, height: '7px', margin: 0 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-blue)',
              minWidth: '32px',
              textAlign: 'right',
            }}
          >
            {progressPct}%
          </span>
        </div>
      </div>
    </div>
  );
}
