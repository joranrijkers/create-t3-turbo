/**
 * UTC day-of-week index to mealPlan.dayShort key (sun, mon, tue, ...).
 */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Returns the short day key for i18n (e.g. "thu") from an ISO date string.
 */
export function getDayShortKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return DAY_KEYS[d.getUTCDay()] ?? "mon";
}

/**
 * Returns the day-of-month number (1–31) for an ISO date string.
 */
export function getDayOfMonth(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.getUTCDate();
}

/**
 * Format a single date for display e.g. "Woensdag 11 maart 2026".
 * Uses UTC to avoid timezone shifts.
 */
export function formatLongDate(dateStr: string, locale: string = "nl-NL"): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = (parts[1] ?? 1) - 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m, d));
  return date.toLocaleDateString(locale.startsWith("nl") ? "nl-NL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Returns the Monday of the week for the given date (ISO YYYY-MM-DD).
 * Week is Mon–Sun.
 */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns start and end date (ISO YYYY-MM-DD) for the week starting at weekStartDate (Monday).
 */
export function getWeekBounds(weekStartDate: string): { start: string; end: string } {
  const start = weekStartDate;
  const parts = start.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const endDate = new Date(Date.UTC(y, m - 1, d + 6));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Returns the Monday of the next week (ISO YYYY-MM-DD).
 */
export function getNextWeekStart(weekStartDate: string): string {
  const parts = weekStartDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d + 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the Monday of the previous week (ISO YYYY-MM-DD).
 */
export function getPrevWeekStart(weekStartDate: string): string {
  const parts = weekStartDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d - 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Format week range for display e.g. "23–29 okt" or "Oct 23 - Oct 29".
 */
export function formatWeekRange(weekStartDate: string): string {
  const parts = weekStartDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const monthNames = [
    "jan", "feb", "mrt", "apr", "mei", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  const mStart = start.getUTCMonth();
  const mEnd = end.getUTCMonth();
  if (mStart === mEnd) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${monthNames[mStart]}`;
  }
  return `${start.getUTCDate()} ${monthNames[mStart]} – ${end.getUTCDate()} ${monthNames[mEnd]}`;
}

/**
 * Returns ISO week number and year for the week that contains the given Monday (weekStartDate).
 * Used for "week 11, 2026" subtitle.
 */
export function getWeekNumberAndYear(weekStartDate: string): { week: number; year: number } {
  const parts = weekStartDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: date.getUTCFullYear() };
}
