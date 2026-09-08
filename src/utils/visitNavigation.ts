export type VisitViewMode = 'list' | 'calendar';

export interface VisitNavigationContext {
  origin: VisitViewMode;
  from?: VisitViewMode;
  month?: string; // YYYY-MM
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates and normalizes month string as YYYY-MM.
 * Returns undefined if invalid or absent.
 */
export function sanitizeMonthParam(monthParam: string | null | undefined): string | undefined {
  if (!monthParam) return undefined;
  const trimmed = monthParam.trim();
  return MONTH_REGEX.test(trimmed) ? trimmed : undefined;
}

/**
 * Formats a Date object to YYYY-MM
 */
export function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Parses a YYYY-MM string to a Date set to the 1st of that month.
 * Falls back to current date if invalid.
 */
export function parseYearMonth(monthStr: string | null | undefined): Date {
  const valid = sanitizeMonthParam(monthStr);
  if (!valid) return new Date();
  const [yearStr, monthNumStr] = valid.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthNumStr, 10) - 1;
  return new Date(year, monthIndex, 1);
}

/**
 * Resolves the visit navigation context (origin view and optional month) from URLSearchParams.
 * Safely defaults to 'list' for missing or invalid parameters.
 */
export function resolveVisitOrigin(
  searchParams: URLSearchParams | string | undefined | null
): VisitNavigationContext {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams)
      : searchParams || new URLSearchParams();

  const rawFrom = (params.get('from') || params.get('view') || '').toLowerCase().trim();
  const origin: VisitViewMode = rawFrom === 'calendar' ? 'calendar' : 'list';
  const month = sanitizeMonthParam(params.get('month'));

  return { origin, from: origin, month };
}

/**
 * Builds the URL back to the main Visits page (/visits) preserving view and month.
 */
export function buildVisitsUrl(context?: Partial<VisitNavigationContext>): string {
  const resolvedMode = context?.origin || context?.from;
  const view: VisitViewMode = resolvedMode === 'calendar' ? 'calendar' : 'list';
  const month = sanitizeMonthParam(context?.month);

  const query = new URLSearchParams();
  query.set('view', view);
  if (view === 'calendar' && month) {
    query.set('month', month);
  }
  return `/visits?${query.toString()}`;
}

/**
 * Builds the URL for Visit Detail (/visits/:id) preserving origin context.
 */
export function buildVisitDetailUrl(
  id: string,
  context?: Partial<VisitNavigationContext>
): string {
  const resolvedMode = context?.origin || context?.from;
  const from: VisitViewMode = resolvedMode === 'calendar' ? 'calendar' : 'list';
  const month = sanitizeMonthParam(context?.month);

  const query = new URLSearchParams();
  query.set('from', from);
  if (from === 'calendar' && month) {
    query.set('month', month);
  }
  return `/visits/${id}?${query.toString()}`;
}

/**
 * Builds the URL for Edit Visit (/visits/:id/edit) preserving origin context.
 */
export function buildVisitEditUrl(
  id: string,
  context?: Partial<VisitNavigationContext>
): string {
  const resolvedMode = context?.origin || context?.from;
  const from: VisitViewMode = resolvedMode === 'calendar' ? 'calendar' : 'list';
  const month = sanitizeMonthParam(context?.month);

  const query = new URLSearchParams();
  query.set('from', from);
  if (from === 'calendar' && month) {
    query.set('month', month);
  }
  return `/visits/${id}/edit?${query.toString()}`;
}

/**
 * Builds the URL for Scheduling a Visit (/visits/schedule) preserving origin context.
 */
export function buildScheduleVisitUrl(
  context?: Partial<VisitNavigationContext> & { customerId?: string; defaultDate?: string }
): string {
  const resolvedMode = context?.origin || context?.from;
  const from: VisitViewMode = resolvedMode === 'calendar' ? 'calendar' : 'list';
  const month = sanitizeMonthParam(context?.month);

  const query = new URLSearchParams();
  query.set('from', from);
  if (from === 'calendar' && month) {
    query.set('month', month);
  }
  if (context?.customerId) {
    query.set('customerId', context.customerId);
  }
  if (context?.defaultDate) {
    query.set('date', context.defaultDate);
  }
  return `/visits/schedule?${query.toString()}`;
}
