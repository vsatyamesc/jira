import React, { useRef, useEffect, useState } from 'react';
import { Clock, Plus, Trash2, AlertTriangle, Briefcase } from 'lucide-react';
import {
  timeToMinutes,
  minutesToTime,
  roundTwo,
  assignTracks,
} from '../../utils/timeUtils';

export default function DayView({
  scheduleData,
  onOpenTimeSlotModal,
  onDeleteTimeSlot,
}) {
  const scrollContainerRef = useRef(null);
  const coreHourTargetRef = useRef(null);

  // Hour height in pixels: 1 hour = 60px -> 1 minute = 1px!
  const HOUR_HEIGHT = 60;
  const TOTAL_DAY_MIN = 24 * 60; // 1440 minutes = 1440px
  const CORE_START_MIN = 8 * 60;  // 08:00 (480px)
  const CORE_END_MIN = 19 * 60;   // 19:00 (1140px)

  useEffect(() => {
    // Automatically smooth-scroll to 08:00 (core workday start)
    if (coreHourTargetRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = CORE_START_MIN - 40;
    }
  }, [scheduleData?.date]);

  if (!scheduleData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading schedule...
      </div>
    );
  }

  const {
    date,
    total_day_hours,
    target_day_hours,
    is_off_day,
    off_day_reason,
    slots = [],
    collisions = [],
  } = scheduleData;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Calculate side-by-side tracks for overlapping single boxes
  const trackedSlots = assignTracks(slots);

  // Set of colliding slot IDs for highlighting
  const collidingSlotIds = new Set();
  if (collisions && collisions.length > 0) {
    collisions.forEach((c) => {
      if (c.slot_1?.id) collidingSlotIds.add(c.slot_1.id);
      if (c.slot_2?.id) collidingSlotIds.add(c.slot_2.id);
    });
  }

  // Handle click on empty timeline space to book that time
  const handleTimelineClick = (e) => {
    // Only fire if clicking on the background grid itself
    if (e.target.closest('.timeline-event-box') || e.target.closest('button')) {
      return;
    }
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const offsetY = e.clientY - rect.top + canvas.scrollTop;
    // Snap to 15-minute interval
    const clickedMinutes = Math.max(0, Math.min(TOTAL_DAY_MIN - 60, Math.floor(offsetY / 15) * 15));
    const startStr = minutesToTime(clickedMinutes);
    const endStr = minutesToTime(clickedMinutes + 60);

    onOpenTimeSlotModal(null, {
      date,
      start_time: startStr,
      end_time: endStr,
    });
  };

  return (
    <div>
      {/* Daily Occupancy Summary Banner */}
      <div className="day-occupancy-banner">
        <div className="occupancy-top-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--accent-blue)" /> 24-Hour Visual Schedule
              </span>
              {date && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'rgba(0, 113, 227, 0.08)',
                    color: 'var(--accent-blue)',
                    border: '1px solid rgba(0, 113, 227, 0.2)',
                    padding: '1px 7px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  📅 {date}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Full day continuous scale (00:00 – 24:00) with core focus on 08:00 – 19:00
            </span>
          </div>

          <div className="occupancy-badges-group">
            <span className="occupancy-pill occupied">
              {total_day_hours}h {is_off_day ? `(${off_day_reason})` : `/ ${target_day_hours}h Logged`}
            </span>
            <span className="occupancy-pill target">
              {target_day_hours}h Target
            </span>
            {collisions && collisions.length > 0 && (
              <span className="occupancy-pill conflict">
                <AlertTriangle size={13} style={{ display: 'inline', marginRight: '3px' }} />
                {collisions.length} Overlap Conflict{collisions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* 24-Hour Mini Overview Bar */}
        <div
          className="proportional-visual-bar"
          style={{
            position: 'relative',
            background: 'var(--bg-surface-hover)',
            height: '24px',
          }}
        >
          {/* Core hours highlight */}
          <div
            style={{
              position: 'absolute',
              left: `${(CORE_START_MIN / TOTAL_DAY_MIN) * 100}%`,
              width: `${((CORE_END_MIN - CORE_START_MIN) / TOTAL_DAY_MIN) * 100}%`,
              height: '100%',
              background: 'rgba(0, 113, 227, 0.08)',
              borderLeft: '1px solid rgba(0, 113, 227, 0.3)',
              borderRight: '1px solid rgba(0, 113, 227, 0.3)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
            title="Core Work Hours (08:00 – 19:00)"
          />

          {trackedSlots.map((s) => {
            if (s._endM <= s._startM) return null;
            const leftPct = (s._startM / TOTAL_DAY_MIN) * 100;
            const widthPct = Math.max(1, ((s._endM - s._startM) / TOTAL_DAY_MIN) * 100);
            const topPct = s.totalTracks > 1 ? (s.trackIndex * (100 / s.totalTracks)) : 0;
            const heightPct = s.totalTracks > 1 ? (100 / s.totalTracks) : 100;
            const isOverlap = collidingSlotIds.has(s.id) || s.isColliding;

            return (
              <div
                key={s.id}
                className="bar-segment"
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: `${topPct}%`,
                  height: `${heightPct}%`,
                  backgroundColor: s.color || '#0071e3',
                  border: isOverlap ? '1px solid var(--accent-amber)' : '0.5px solid rgba(255,255,255,0.2)',
                  zIndex: 2,
                  boxSizing: 'border-box',
                }}
                title={`[${s.key}] ${s.title} (${s.start_time} - ${s.end_time}, ${s.duration_hours}h)`}
              >
                {s.key}
              </div>
            );
          })}
        </div>

        {/* 24-Hour Markers */}
        <div className="hour-markers-row">
          <span>00:00</span>
          <span>04:00</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>08:00 (Workday)</span>
          <span>12:00</span>
          <span>16:00</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>19:00 (Core End)</span>
          <span>22:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Continuous Timeline Canvas with Single Boxes Spanning Exact Time */}
      <div
        ref={scrollContainerRef}
        style={{
          background: 'var(--bg-surface)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          height: '620px',
          overflowY: 'auto',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: `${TOTAL_DAY_MIN}px`, // 1440px (1px per minute)
            display: 'flex',
          }}
          onClick={handleTimelineClick}
        >
          {/* Left Time Ruler Gutter */}
          <div
            style={{
              width: '72px',
              minWidth: '72px',
              position: 'relative',
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface-solid)',
              zIndex: 3,
            }}
          >
            {hours.map((h) => {
              const hourStr = `${String(h).padStart(2, '0')}:00`;
              const isCoreHour = h >= 8 && h < 19;
              const isStartOfCore = h === 8;

              return (
                <div
                  key={h}
                  ref={isStartOfCore ? coreHourTargetRef : null}
                  style={{
                    position: 'absolute',
                    top: `${h * HOUR_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: `${HOUR_HEIGHT}px`,
                    padding: '4px 8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: isCoreHour ? 700 : 500,
                    color: isCoreHour ? 'var(--accent-blue)' : 'var(--text-faint)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{hourStr}</span>
                  {isStartOfCore && (
                    <span title="Core Workday Focus">
                      <Briefcase size={11} color="var(--accent-blue)" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Continuous Timeline Grid */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              cursor: 'crosshair',
            }}
          >
            {/* Core Work Hours Tint (08:00 - 19:00) */}
            <div
              style={{
                position: 'absolute',
                top: `${CORE_START_MIN}px`,
                height: `${CORE_END_MIN - CORE_START_MIN}px`,
                left: 0,
                right: 0,
                background: 'rgba(0, 113, 227, 0.025)',
                borderTop: '1px dashed rgba(0, 113, 227, 0.3)',
                borderBottom: '1px dashed rgba(0, 113, 227, 0.3)',
                pointerEvents: 'none',
              }}
            />

            {/* Horizontal Gridlines for Each Hour & Half-Hour */}
            {hours.map((h) => (
              <React.Fragment key={h}>
                {/* Full hour line */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${h * HOUR_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: 'var(--border-subtle)',
                    pointerEvents: 'none',
                  }}
                />
                {/* 30-minute subtle dashed line */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${h * HOUR_HEIGHT + 30}px`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    borderTop: '1px dashed rgba(120, 120, 128, 0.1)',
                    pointerEvents: 'none',
                  }}
                />
              </React.Fragment>
            ))}

            {/* SINGLE TASK BOXES SPANNING CONTINUOUS TIME */}
            {trackedSlots.map((slot) => {
              const startM = slot._startM;
              const endM = slot._endM;
              if (endM <= startM) return null;

              const durationM = endM - startM;
              const topPx = startM;
              const heightPx = Math.max(28, durationM); // minimum 28px height so text is readable

              // Side-by-side positioning if multiple slots overlap
              const totalTracks = slot.totalTracks || 1;
              const trackIndex = slot.trackIndex || 0;
              const trackWidthPct = 100 / totalTracks;
              const leftPct = trackIndex * trackWidthPct;
              const isOverlap = collidingSlotIds.has(slot.id) || slot.isColliding;
              const accentColor = slot.color || '#0071e3';

              return (
                <div
                  key={slot.id}
                  className="timeline-event-box"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${trackWidthPct}% - 8px)`,
                    backgroundColor: accentColor,
                    backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, rgba(0,0,0,0.15) 100%)`,
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.25)',
                    border: isOverlap ? '2px solid var(--accent-amber)' : '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    padding: durationM < 40 ? '2px 8px' : '6px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: durationM < 40 ? 'center' : 'flex-start',
                    overflow: 'hidden',
                    cursor: 'default',
                    zIndex: isOverlap ? 5 : 4,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  title={`[${slot.key}] ${slot.title}\n${slot.start_time} – ${slot.end_time} (${slot.duration_hours}h)${slot.notes ? `\n"${slot.notes}"` : ''}${isOverlap ? '\n⚠️ Overlap Conflict' : ''}`}
                >
                  {/* Header Row: Key Badge + Time Badge + Action Icons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                      fontSize: '0.72rem',
                      lineHeight: 1.2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                      <span
                        style={{
                          background: 'rgba(255, 255, 255, 0.25)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-xs)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {slot.key}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        }}
                      >
                        {slot.start_time} – {slot.end_time} ({slot.duration_hours}h)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      {isOverlap && (
                        <span
                          title="Overlaps with another task"
                          style={{
                            background: 'rgba(255, 149, 0, 0.9)',
                            color: '#000000',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            padding: '1px 4px',
                            borderRadius: 'var(--radius-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <AlertTriangle size={9} /> Overlap
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTimeSlot(slot.id);
                        }}
                        title="Delete this time slot"
                        style={{
                          background: 'rgba(0, 0, 0, 0.2)',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-xs)',
                          padding: '2px 4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Notes (for slots >= 40 minutes) */}
                  {durationM >= 40 && (
                    <div style={{ marginTop: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                        }}
                      >
                        {slot.title}
                      </div>

                      {slot.notes && durationM >= 60 && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'rgba(255, 255, 255, 0.85)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '1px',
                            fontStyle: 'italic',
                          }}
                        >
                          "{slot.notes}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
