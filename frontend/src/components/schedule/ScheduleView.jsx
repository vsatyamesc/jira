import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import DayView from './DayView';
import WeekView from './WeekView';
import API from '../../api/client';
import { formatDateIso, getMondayOfCurrentWeek } from '../../utils/timeUtils';

export default function ScheduleView({
  activeSprint,
  onOpenTimeSlotModal,
  showToast,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [dayData, setDayData] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const dateInputRef = useRef(null);

  const fetchDaySchedule = async (dateStr) => {
    try {
      setLoading(true);
      const sprintId = activeSprint ? activeSprint.id : null;
      const data = await API.getDaySchedule(dateStr, sprintId);
      setDayData(data);
    } catch (err) {
      showToast(`Failed to load day schedule: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekSchedule = async (baseDate) => {
    try {
      setLoading(true);
      const monday = getMondayOfCurrentWeek(baseDate);
      const startDateStr = formatDateIso(monday);
      const sprintId = activeSprint ? activeSprint.id : null;
      const matrix = await API.getTimesheet(sprintId, startDateStr, 7);

      // Map date_columns with their slots from matrix rows
      const days = matrix.date_columns.map((col) => {
        const slotsForDay = [];
        matrix.rows.forEach((row) => {
          const cell = row.cells[col.date];
          if (cell && cell.slots) {
            slotsForDay.push(...cell.slots);
          }
        });

        return {
          ...col,
          slots: slotsForDay,
          total_hours: matrix.daily_aggregates.find((da) => da.date === col.date)?.total_hours || 0,
        };
      });

      setWeekDays(days);
    } catch (err) {
      showToast(`Failed to load week schedule: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dateStr = formatDateIso(currentDate);
    if (viewMode === 'day') {
      fetchDaySchedule(dateStr);
    } else {
      fetchWeekSchedule(currentDate);
    }
  }, [currentDate, viewMode, activeSprint]);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDeleteTimeSlot = async (slotId) => {
    try {
      await API.deleteTimeSlot(slotId);
      showToast('Time slot removed', 'success');
      const dateStr = formatDateIso(currentDate);
      fetchDaySchedule(dateStr);
    } catch (err) {
      showToast(`Failed to delete slot: ${err.message}`, 'error');
    }
  };

  const formattedDateTitle = currentDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Schedule Controls */}
      <div className="schedule-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div className="date-nav-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePrev} title="Previous Day">
            <ChevronLeft size={14} /> Prev
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleToday} title="Jump to Today">
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleNext} title="Next Day">
            Next <ChevronRight size={14} />
          </button>

          {/* Interactive Date Picker Trigger */}
          <div
            className="interactive-date-picker-box"
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch (_) {
                dateInputRef.current?.focus();
              }
            }}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
            }}
            title="Click to select any date"
          >
            <CalIcon size={15} color="var(--accent-blue)" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              {formattedDateTitle}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▾</span>

            {/* Native date input overlay */}
            <input
              ref={dateInputRef}
              type="date"
              value={formatDateIso(currentDate)}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setCurrentDate(new Date(y, m - 1, d, 12, 0, 0));
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="tabs-segmented">
          <button
            className={`tab-pill ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Day View
          </button>
          <button
            className={`tab-pill ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week View
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'day' ? (
        <DayView
          scheduleData={dayData}
          onOpenTimeSlotModal={onOpenTimeSlotModal}
          onDeleteTimeSlot={handleDeleteTimeSlot}
        />
      ) : (
        <WeekView
          weekDays={weekDays}
          onOpenTimeSlotModal={onOpenTimeSlotModal}
          onSelectDay={(dStr) => {
            setCurrentDate(new Date(dStr));
            setViewMode('day');
          }}
        />
      )}
    </div>
  );
}
