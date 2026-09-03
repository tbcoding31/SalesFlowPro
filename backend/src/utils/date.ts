export const getBusinessDate = (dateOrVal: any = new Date(), timeZone = 'Asia/Jakarta'): string | null => {
  if (!dateOrVal) return null;

  if (typeof dateOrVal === 'string') {
    const trimmed = dateOrVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const mysqlDateTimeMatch = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
    if (mysqlDateTimeMatch) {
      return mysqlDateTimeMatch[1];
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      dateOrVal = parsed;
    } else {
      return null;
    }
  }

  if (dateOrVal instanceof Date) {
    if (isNaN(dateOrVal.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateOrVal);
  }

  return null;
};
