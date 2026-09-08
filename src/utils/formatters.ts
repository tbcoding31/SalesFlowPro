/**
 * Shared Date and Time Utilities for SalesFlow Pro
 * 
 * Provides database-authoritative, consistent timezone formatting across
 * System Audit, Tenant Details, Audit Logs, and Customer Management.
 */

export interface FormatDateTimeOptions {
  timeZone?: string;
  dateFormat?: string;
  includeSeconds?: boolean;
  includeZoneSuffix?: boolean;
  nullLabel?: string;
}

export function formatDateTime(
  val: any,
  optionsOrNullLabel?: FormatDateTimeOptions | string
): string {
  const defaultOptions: FormatDateTimeOptions = {
    timeZone: 'Asia/Jakarta',
    includeSeconds: false,
    includeZoneSuffix: false,
    nullLabel: '—'
  };

  const opts: FormatDateTimeOptions = typeof optionsOrNullLabel === 'string'
    ? { ...defaultOptions, nullLabel: optionsOrNullLabel }
    : { ...defaultOptions, ...optionsOrNullLabel };

  if (!val) return opts.nullLabel || '—';

  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return opts.nullLabel || '—';

    let formatted = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(opts.includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
      timeZone: opts.timeZone || 'Asia/Jakarta'
    }).format(d);

    formatted = formatted.replace('Sept', 'Sep');

    if (opts.includeZoneSuffix) {
      if ((opts.timeZone || 'Asia/Jakarta') === 'Asia/Jakarta' && !formatted.includes('WIB')) {
        return `${formatted} WIB`;
      }
    }

    return formatted;
  } catch {
    return opts.nullLabel || '—';
  }
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function formatDate(
  val: any,
  optionsOrNullLabel?: { timeZone?: string; nullLabel?: string } | string
): string {
  const nullLabel = typeof optionsOrNullLabel === 'string'
    ? optionsOrNullLabel
    : optionsOrNullLabel?.nullLabel || '—';

  if (!val) return nullLabel;

  // Exact date-only contract: if string is YYYY-MM-DD or starts with YYYY-MM-DD
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const monthIdx = parseInt(match[2], 10) - 1;
      const day = match[3];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} ${MONTH_NAMES_SHORT[monthIdx]} ${year}`;
      }
    }
  }

  const timeZone = typeof optionsOrNullLabel === 'object' && optionsOrNullLabel.timeZone
    ? optionsOrNullLabel.timeZone
    : 'Asia/Jakarta';

  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return nullLabel;

    let formatted = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone
    }).format(d);

    return formatted.replace('Sept', 'Sep');
  } catch {
    return nullLabel;
  }
}

/**
 * Format a TIME string (e.g. "10:00:00" -> "10:00")
 */
export function formatTime(val: any, nullLabel = '—'): string {
  if (!val) return nullLabel;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  const h = match[1].padStart(2, '0');
  const m = match[2];
  return `${h}:${m}`;
}

/**
 * Format a time range (e.g. "10:00 - 11:30")
 */
export function formatTimeRange(startTime: any, endTime: any, nullLabel = '—'): string {
  if (!startTime && !endTime) return nullLabel;
  if (startTime && !endTime) return formatTime(startTime);
  if (!startTime && endTime) return formatTime(endTime);
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/**
 * Calculate and format duration between startTime and endTime
 * Handles edge cases:
 * 09:00 -> 10:30 (1.5 Hours)
 * 10:00 -> 11:30 (1.5 Hours)
 * 13:15 -> 14:00 (45 Mins)
 * 10:00 -> 11:00 (1 Hour)
 * 10:00 -> 12:00 (2 Hours)
 */
export function formatDuration(startTime: any, endTime: any, nullLabel = '—'): string {
  if (!startTime || !endTime) return nullLabel;

  const parseToMins = (t: string): number | null => {
    const match = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };

  const startMins = parseToMins(startTime);
  const endMins = parseToMins(endTime);

  if (startMins === null || endMins === null || endMins <= startMins) {
    return nullLabel;
  }

  const diffMins = endMins - startMins;

  if (diffMins === 60) return '1 Hour';
  if (diffMins % 60 === 0) return `${diffMins / 60} Hours`;
  if (diffMins % 30 === 0) return `${(diffMins / 60).toFixed(1)} Hours`;
  if (diffMins < 60) return `${diffMins} Mins`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

