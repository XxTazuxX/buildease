const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses an ISO date or timestamp. Date-only values ("2026-01-31") are read as local calendar
 * dates; `new Date("2026-01-31")` would parse them as UTC midnight and show the previous day in
 * time zones west of UTC.
 */
export function parseDate(value: string): Date {
  const match = dateOnly.exec(value);
  if (match)
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

export function formatDate(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

/** Today's local calendar date as YYYY-MM-DD (for date inputs and API bodies). */
export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from today until a date-only value (negative when it is in the past). */
export function daysUntil(value: string, now = new Date()) {
  const target = parseDate(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
