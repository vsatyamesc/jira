import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Table as TableIcon,
  Calendar,
  Layers,
  Globe,
} from 'lucide-react';
import CellSlotsModal from './CellSlotsModal';
import API from '../../api/client';
import { formatDateIso, getMondayOfCurrentWeek } from '../../utils/timeUtils';

export default function TimesheetMatrix({
  activeSprint,
  onOpenTimeSlotModal,
  showToast,
}) {
  // Default mode is now 'sprint' (Full Sprint) as requested!
  const [viewMode, setViewMode] = useState('sprint'); // 'sprint' | 'week' | 'all'
  const [currentStartDate, setCurrentStartDate] = useState(() =>
    formatDateIso(getMondayOfCurrentWeek())
  );
  // Period duration for 'all' mode: 14 days (bi-weekly)
  const [allDaysCount, setAllDaysCount] = useState(14);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  const fetchTimesheet = async (startDate, mode, daysCount) => {
    try {
      setLoading(true);
      const sprintId = mode === 'all' ? null : activeSprint ? activeSprint.id : null;
      const effectiveDays = mode === 'week' ? 7 : mode === 'all' ? daysCount : 7;
      const data = await API.getTimesheet(sprintId, startDate, effectiveDays, mode);
      setMatrixData(data);
    } catch (err) {
      showToast(`Failed to load timesheet: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheet(currentStartDate, viewMode, allDaysCount);
  }, [currentStartDate, viewMode, allDaysCount, activeSprint]);

  // Navigation handlers
  const stepDays = viewMode === 'week' ? 7 : allDaysCount;

  const handlePrevPeriod = () => {
    const d = new Date(currentStartDate);
    d.setDate(d.getDate() - stepDays);
    setCurrentStartDate(formatDateIso(d));
  };

  const handleNextPeriod = () => {
    const d = new Date(currentStartDate);
    d.setDate(d.getDate() + stepDays);
    setCurrentStartDate(formatDateIso(d));
  };

  const handleCurrentPeriod = () => {
    setCurrentStartDate(formatDateIso(getMondayOfCurrentWeek()));
  };

  const handleExportCsv = () => {
    // If 'all' mode, don't restrict to sprint_id
    const sprintId = viewMode === 'all' ? null : activeSprint ? activeSprint.id : null;
    window.location.href = API.getExportCsvUrl(sprintId);
    showToast(
      viewMode === 'all'
        ? 'Exporting Full Time Matrix (All Sprints) to Excel / CSV...'
        : 'Exporting sprint timesheet to Excel / CSV...',
      'success'
    );
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      await API.deleteTimeSlot(slotId);
      showToast('Time slot removed', 'success');
      setSelectedCell(null);
      fetchTimesheet(currentStartDate, viewMode, allDaysCount);
    } catch (err) {
      showToast(`Failed to remove slot: ${err.message}`, 'error');
    }
  };

  const rangeLabel =
    matrixData && matrixData.date_columns && matrixData.date_columns.length > 0
      ? `${matrixData.date_columns[0].formatted} – ${matrixData.date_columns[matrixData.date_columns.length - 1].formatted}`
      : '';

  return (
    <div className="timesheet-matrix-card">
      {/* Toolbar */}
      <div className="timesheet-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TableIcon size={16} color="var(--accent-blue)" /> Timesheet Matrix
          </span>

          {/* Segmented Mode Selector: Full Sprint (Default) | This Week | Full Time Matrix */}
          <div className="tabs-segmented" style={{ padding: '2px' }}>
            <button
              className={`tab-pill ${viewMode === 'sprint' ? 'active' : ''}`}
              onClick={() => setViewMode('sprint')}
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              title="View all dates in the currently selected sprint"
            >
              <Layers size={12} /> Full Sprint {activeSprint ? `(${activeSprint.name})` : ''}
            </button>

            <button
              className={`tab-pill ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              title="View 7-day Monday to Sunday matrix"
            >
              <Calendar size={12} /> This Week
            </button>

            <button
              className={`tab-pill ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              title="Full Time Matrix: Shows all tasks across all sprints unbound by sprint selection"
            >
              <Globe size={12} /> Full Time Matrix (All Sprints)
            </button>
          </div>

          {/* Period Navigation (Visible for Week and All Sprints mode) */}
          {(viewMode === 'week' || viewMode === 'all') && (
            <div className="date-nav-group" style={{ marginLeft: '0.25rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={handlePrevPeriod}>
                <ChevronLeft size={13} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleCurrentPeriod}>
                Current
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleNextPeriod}>
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Period scale selector for 'all' mode (14 vs 30 days) */}
          {viewMode === 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className={`btn btn-sm ${allDaysCount === 14 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAllDaysCount(14)}
                style={{ padding: '2px 7px', fontSize: '0.7rem' }}
              >
                14 Days
              </button>
              <button
                className={`btn btn-sm ${allDaysCount === 30 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAllDaysCount(30)}
                style={{ padding: '2px 7px', fontSize: '0.7rem' }}
              >
                30 Days
              </button>
            </div>
          )}

          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {rangeLabel}
          </span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleExportCsv}>
          <Download size={13} />
          <span>{viewMode === 'all' ? 'Export All Tasks CSV' : 'Export to CSV / Excel'}</span>
        </button>
      </div>

      {/* Mode Sub-banner Info */}
      {viewMode === 'all' && (
        <div
          style={{
            background: 'rgba(0, 113, 227, 0.06)',
            border: '1px solid rgba(0, 113, 227, 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            fontSize: '0.75rem',
            color: 'var(--text-main)',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Globe size={14} color="var(--accent-blue)" />
          <span>
            <strong>Full Time Matrix Mode:</strong> Showing all tasks and time logs across all sprints and backlog, unbound by sprint filter.
          </span>
        </div>
      )}

      {/* Spreadsheet Table */}
      {loading && !matrixData ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading timesheet matrix...
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="timesheet-table">
            <thead>
              <tr>
                <th style={{ minWidth: '240px' }}>Task & Story Points</th>
                {viewMode === 'all' && (
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Sprint</th>
                )}
                <th style={{ width: '85px', textAlign: 'center' }}>Status</th>
                {matrixData?.date_columns.map((col) => (
                  <th
                    key={col.date}
                    className={`matrix-date-th ${col.is_today ? 'today' : ''}`}
                    style={{ textAlign: 'center', minWidth: '85px' }}
                  >
                    <div style={{ fontWeight: 700 }}>{col.day_name}</div>
                    <div style={{ fontSize: '0.75rem' }}>{col.formatted}</div>
                    {col.is_off_day ? (
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-amber)', display: 'block' }}>
                        {col.off_day_reason ? col.off_day_reason.split(' ')[0] : 'Off'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', display: 'block' }}>
                        {col.target_hours}h target
                      </span>
                    )}
                  </th>
                ))}
                <th style={{ width: '85px', textAlign: 'center' }}>Total</th>
                <th style={{ width: '100px' }}>Progress</th>
              </tr>
            </thead>

            <tbody>
              {matrixData?.rows.map((r) => {
                const { task, budgeted_hours, total_logged_hours, percent_spent, cells } = r;
                return (
                  <tr key={task.id}>
                    {/* Task details */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className="task-key-badge"
                          style={{
                            color: task.color || 'var(--accent-blue)',
                            background: task.color ? `${task.color}18` : undefined,
                          }}
                        >
                          {task.key}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{task.title}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        ⚡ {task.story_points} SP ({budgeted_hours}h budget)
                      </div>
                    </td>

                    {/* Sprint tag (in All Sprints mode) */}
                    {viewMode === 'all' && (
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="brand-tag"
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 7px',
                            background: task.sprint_name ? 'rgba(0, 113, 227, 0.1)' : 'var(--bg-surface-hover)',
                            color: task.sprint_name ? 'var(--accent-blue)' : 'var(--text-faint)',
                          }}
                        >
                          {task.sprint_name || 'Backlog'}
                        </span>
                      </td>
                    )}

                    {/* Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {task.status ? task.status.replace('_', ' ') : 'todo'}
                      </span>
                    </td>

                    {/* Date Cells */}
                    {matrixData.date_columns.map((col) => {
                      const cell = cells[col.date] || { hours: 0, slots: [] };
                      const hasHours = cell.hours > 0;
                      return (
                        <td
                          key={col.date}
                          className={`matrix-cell ${hasHours ? 'has-hours' : ''} ${col.is_off_day ? 'off-day' : ''}`}
                          onClick={() =>
                            setSelectedCell({
                              task,
                              date: col.date,
                              slots: cell.slots,
                            })
                          }
                          title={`Click to view/add slots for ${task.key} on ${col.date}`}
                        >
                          {hasHours ? `${cell.hours}h` : '—'}
                        </td>
                      );
                    })}

                    {/* Total Logged */}
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {total_logged_hours}h
                    </td>

                    {/* Progress bar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="card-progress-track" style={{ flex: 1 }}>
                          <div
                            className={`card-progress-fill ${percent_spent >= 100 ? 'completed' : ''}`}
                            style={{ width: `${Math.min(100, percent_spent)}%` }}
                          />
                        </div>
                        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {percent_spent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Daily Aggregate Row */}
              {matrixData?.daily_aggregates && (
                <tr className="daily-total-row">
                  <td
                    colSpan={viewMode === 'all' ? 3 : 2}
                    style={{ textAlign: 'right', fontWeight: 700, paddingRight: '1rem' }}
                  >
                    Daily Total Logged:
                  </td>
                  {matrixData.daily_aggregates.map((da) => {
                    const isTargetMet = da.total_hours >= da.target_hours && da.target_hours > 0;
                    return (
                      <td
                        key={da.date}
                        className={`matrix-cell ${isTargetMet ? 'daily-total-cell target-met' : ''}`}
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {da.total_hours}h
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-blue)' }}>
                    {matrixData.grand_total_hours}h
                  </td>
                  <td style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    of {matrixData.total_budgeted_hours}h
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell Slots Modal */}
      {selectedCell && (
        <CellSlotsModal
          cellInfo={selectedCell}
          onClose={() => setSelectedCell(null)}
          onDeleteSlot={handleDeleteSlot}
          onAddMoreSlot={(taskId, dateStr) => {
            onOpenTimeSlotModal(taskId, { date: dateStr, start_time: '09:00', end_time: '11:00' });
          }}
        />
      )}
    </div>
  );
}
