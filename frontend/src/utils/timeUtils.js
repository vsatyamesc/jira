// Client-side Time and Duration Utilities

export function roundTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function minutesToTime(mins) {
  const norm = (mins % (24 * 60) + (24 * 60)) % (24 * 60);
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseDurationClient(durStr, hoursPerDay = 8.0, workingDays = 5) {
  if (!durStr) return null;
  const s = durStr.trim();
  if (!s) return null;

  // Plain number
  if (/^(\d+(\.\d+)?)$/.test(s)) {
    return parseFloat(s);
  }

  // Colon format "02:30"
  if (/^(\d{1,2}):(\d{2})$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    return roundTwo(h + m / 60.0);
  }

  // Jira format
  const regex = /^(?:(\d+(?:\.\d+)?)\s*w)?\s*(?:(\d+(?:\.\d+)?)\s*d)?\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?$/i;
  const match = s.match(regex);
  if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) {
    return null;
  }

  const w = parseFloat(match[1] || 0);
  const d = parseFloat(match[2] || 0);
  const h = parseFloat(match[3] || 0);
  const m = parseFloat(match[4] || 0);

  const totalHours = (w * workingDays * hoursPerDay) + (d * hoursPerDay) + h + (m / 60.0);
  return roundTwo(totalHours);
}

export function formatJiraDurationClient(hours, hoursPerDay = 8.0) {
  if (!hours || hours <= 0) return '0m';
  const totalMinutes = Math.round(hours * 60);
  const dayMinutes = Math.round(hoursPerDay * 60);

  const d = Math.floor(totalMinutes / dayMinutes);
  const rem = totalMinutes % dayMinutes;
  const h = Math.floor(rem / 60);
  const m = rem % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.length > 0 ? parts.join(' ') : `${hours}h`;
}

export function formatDateIso(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMondayOfCurrentWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Assigns tracks (0, 1, 2, ...) to overlapping time items so they can be rendered
 * side-by-side or vertically partitioned without occluding each other.
 */
export function assignTracks(items) {
  if (!items || items.length === 0) return [];

  const sorted = [...items]
    .map((item, idx) => ({
      ...item,
      _origIdx: idx,
      _startM: timeToMinutes(item.start_time),
      _endM: timeToMinutes(item.end_time),
    }))
    .sort((a, b) => a._startM - b._startM || b._endM - a._endM);

  const tracks = [];
  const assigned = [];

  for (const item of sorted) {
    let placedTrack = -1;
    for (let t = 0; t < tracks.length; t++) {
      if (tracks[t] <= item._startM) {
        placedTrack = t;
        tracks[t] = item._endM;
        break;
      }
    }
    if (placedTrack === -1) {
      placedTrack = tracks.length;
      tracks.push(item._endM);
    }
    assigned.push({
      ...item,
      trackIndex: placedTrack,
    });
  }

  return assigned.map((item) => {
    const overlapping = assigned.filter(
      (other) => item._startM < other._endM && item._endM > other._startM
    );
    const maxTrack = Math.max(...overlapping.map((o) => o.trackIndex), 0);
    return {
      ...item,
      totalTracks: Math.max(1, maxTrack + 1),
      isColliding: overlapping.length > 1,
    };
  });
}
