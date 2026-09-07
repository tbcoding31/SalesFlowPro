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

export function formatDate(
  val: any,
  optionsOrNullLabel?: { timeZone?: string; nullLabel?: string } | string
): string {
  const nullLabel = typeof optionsOrNullLabel === 'string'
    ? optionsOrNullLabel
    : optionsOrNullLabel?.nullLabel || '—';
  const timeZone = typeof optionsOrNullLabel === 'object' && optionsOrNullLabel.timeZone
    ? optionsOrNullLabel.timeZone
    : 'Asia/Jakarta';

  if (!val) return nullLabel;

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
