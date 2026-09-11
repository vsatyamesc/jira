import React from 'react';
import { Plus, Clock } from 'lucide-react';

export default function WeekView({
  weekDays,
  onOpenTimeSlotModal,
  onSelectDay,
}) {
  if (!weekDays || weekDays.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading week data...</div>;
  }

  return (
    <div className="week-grid-container">
      {weekDays.map((day) => {
        const isToday = day.is_today;
        return (
          <div key={day.date} className={`week-day-col ${isToday ? 'today' : ''}`}>
            <div className="week-day-header">
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isToday ? 'var(--accent-blue)' : 'var(--text-main)' }}>
                {day.day_name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{day.formatted}</div>
              <div style={{ marginTop: '4px' }}>
                {day.is_off_day ? (
                  <span className="occupancy-pill" style={{ background: 'rgba(255, 149, 0, 0.12)', color: 'var(--accent-amber)', fontSize: '0.65rem' }}>
                    {day.off_day_reason ? day.off_day_reason.split(' ')[0] : 'Off'}
                  </span>
                ) : (
                  <span className="occupancy-pill target" style={{ fontSize: '0.65rem' }}>
                    {day.target_hours}h target
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '4px', color: 'var(--text-main)' }}>
                Logged: {day.total_hours || 0}h
              </div>
            </div>

            {/* Slots for this day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {day.slots && day.slots.map((slot) => (
                <div
                  key={slot.id}
                  className="slot-chip"
                  style={{
                    '--chip-color': slot.color || '#0071e3',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.35rem 0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span className="task-key-badge">{slot.key}</span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {slot.duration_hours}h
                    </span>
                  </div>
                  <div style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.2 }}>
                    {slot.title}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                    {slot.start_time} - {slot.end_time}
                  </div>
                </div>
              ))}

              {(!day.slots || day.slots.length === 0) && (
                <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.72rem', padding: '1.5rem 0' }}>
                  No slots logged
                </div>
              )}
            </div>

            {/* Quick Add Button */}
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
              onClick={() => onOpenTimeSlotModal(null, { date: day.date, start_time: '09:00', end_time: '11:00' })}
            >
              <Plus size={12} /> Log Slot
            </button>
          </div>
        );
      })}
    </div>
  );
}
