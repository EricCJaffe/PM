/**
 * Recurrence Engine — computes occurrence dates for task series.
 *
 * Supports:
 *   - daily / weekly / monthly / yearly frequencies
 *   - every N intervals
 *   - specific weekdays (by_weekday)
 *   - day-of-month rules (by_monthday)
 *   - ordinal weekday rules (by_setpos + by_weekday): "first Monday", "last Friday"
 *   - end conditions: never / until_date / max_count
 *   - completion-based recurrence (caller provides last completion date)
 *   - exception dates (skip / reschedule)
 */

import type { TaskSeries, SeriesException } from "@/types/pm";

// ─── Helpers ────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" → Date at midnight UTC */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format Date → "YYYY-MM-DD" */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(d: Date): number {
  return d.getUTCDay(); // 0=Sun..6=Sat
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

/** Last day of month for a given date */
function lastDayOfMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Find the Nth weekday in a given month/year.
 * setpos: 1=first, 2=second, -1=last, -2=second-to-last
 * weekday: 0=Sun..6=Sat
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, setpos: number): Date | null {
  if (setpos > 0) {
    // Forward from start of month
    const first = new Date(Date.UTC(year, month, 1));
    let dow = first.getUTCDay();
    let diff = (weekday - dow + 7) % 7;
    const day = 1 + diff + (setpos - 1) * 7;
    if (day > lastDayOfMonth(first)) return null;
    return new Date(Date.UTC(year, month, day));
  } else {
    // Backward from end of month
    const last = new Date(Date.UTC(year, month + 1, 0));
    let dow = last.getUTCDay();
    let diff = (dow - weekday + 7) % 7;
    const day = last.getUTCDate() - diff + (setpos + 1) * 7;
    if (day < 1) return null;
    return new Date(Date.UTC(year, month, day));
  }
}

// ─── Occurrence Generator ───────────────────────────────────────────

export interface GenerateOptions {
  /** Generate occurrences up to this date (inclusive) */
  horizon: string;
  /** Maximum number of occurrences to return */
  limit?: number;
  /** Only return dates strictly after this date (exclusive) */
  after?: string;
  /** Exception dates for this series */
  exceptions?: SeriesException[];
}

/**
 * Compute occurrence dates for a task series.
 * Returns an array of "YYYY-MM-DD" strings in chronological order.
 *
 * For completion-based mode, pass the last completion date via
 * series.last_generated_date — the engine will compute the next
 * single occurrence from that date + completion_delay_days.
 */
export function generateOccurrences(
  series: TaskSeries,
  opts: GenerateOptions
): string[] {
  const horizon = parseDate(opts.horizon);
  const limit = opts.limit ?? 365; // safety cap
  const afterDate = opts.after ? parseDate(opts.after) : null;

  // Build exception lookup
  const skipDates = new Set<string>();
  const rescheduleDates = new Map<string, string>();
  if (opts.exceptions) {
    for (const ex of opts.exceptions) {
      if (ex.exception_type === "skip") {
        skipDates.add(ex.exception_date);
      } else if (ex.exception_type === "reschedule" && ex.reschedule_to) {
        rescheduleDates.set(ex.exception_date, ex.reschedule_to);
      }
    }
  }

  const results: string[] = [];

  if (series.recurrence_mode === "completion") {
    // Completion-based: compute just the next occurrence
    if (!series.last_generated_date) {
      // First occurrence = dtstart
      const d = series.dtstart;
      if (!skipDates.has(d)) {
        const final = rescheduleDates.get(d) ?? d;
        if (parseDate(final) <= horizon && (!afterDate || parseDate(final) > afterDate)) {
          results.push(final);
        }
      }
    } else {
      const delay = series.completion_delay_days ?? 1;
      const next = addDays(parseDate(series.last_generated_date), delay);
      const nextStr = fmtDate(next);
      if (next <= horizon && (!afterDate || next > afterDate)) {
        if (!skipDates.has(nextStr)) {
          results.push(rescheduleDates.get(nextStr) ?? nextStr);
        }
      }
    }
    return results;
  }

  // Fixed schedule mode — iterate through dates
  const dtstart = parseDate(series.dtstart);
  const interval = series.interval;
  const byWeekday = series.by_weekday ?? [];
  const byMonthday = series.by_monthday ?? [];
  const bySetpos = series.by_setpos;
  const untilDate = series.until_date ? parseDate(series.until_date) : null;
  const maxCount = series.max_count;
  let totalGenerated = series.generated_count;

  let cursor: Date;
  let iterCount = 0;
  const MAX_ITER = 3650; // 10-year safety limit

  switch (series.freq) {
    case "daily":
      cursor = new Date(dtstart);
      while (cursor <= horizon && iterCount < MAX_ITER) {
        iterCount++;
        if (untilDate && cursor > untilDate) break;
        if (maxCount && totalGenerated + results.length >= maxCount) break;
        if (results.length >= limit) break;

        const ds = fmtDate(cursor);
        if (!afterDate || cursor > afterDate) {
          if (byWeekday.length > 0) {
            // Filter to specific weekdays
            if (byWeekday.includes(dayOfWeek(cursor)) && !skipDates.has(ds)) {
              results.push(rescheduleDates.get(ds) ?? ds);
            }
          } else if (!skipDates.has(ds)) {
            results.push(rescheduleDates.get(ds) ?? ds);
          }
        }
        cursor = addDays(cursor, interval);
      }
      break;

    case "weekly":
      cursor = new Date(dtstart);
      if (byWeekday.length > 0) {
        // Weekly with specific weekdays: iterate day-by-day within each week
        while (cursor <= horizon && iterCount < MAX_ITER) {
          // Find start of this "recurrence week"
          const weekStart = new Date(cursor);
          const weekEnd = addDays(weekStart, 7);

          for (let d = new Date(weekStart); d < weekEnd && d <= horizon; d = addDays(d, 1)) {
            iterCount++;
            if (iterCount >= MAX_ITER) break;
            if (untilDate && d > untilDate) break;
            if (maxCount && totalGenerated + results.length >= maxCount) break;
            if (results.length >= limit) break;

            if (d < dtstart) continue;
            const ds = fmtDate(d);
            if (byWeekday.includes(dayOfWeek(d)) && (!afterDate || d > afterDate) && !skipDates.has(ds)) {
              results.push(rescheduleDates.get(ds) ?? ds);
            }
          }
          cursor = addDays(weekStart, 7 * interval);
        }
      } else {
        // Simple weekly: same day of week as dtstart
        while (cursor <= horizon && iterCount < MAX_ITER) {
          iterCount++;
          if (untilDate && cursor > untilDate) break;
          if (maxCount && totalGenerated + results.length >= maxCount) break;
          if (results.length >= limit) break;

          const ds = fmtDate(cursor);
          if ((!afterDate || cursor > afterDate) && !skipDates.has(ds)) {
            results.push(rescheduleDates.get(ds) ?? ds);
          }
          cursor = addDays(cursor, 7 * interval);
        }
      }
      break;

    case "monthly":
      cursor = new Date(dtstart);
      while (cursor <= horizon && iterCount < MAX_ITER) {
        iterCount++;
        if (untilDate && cursor > untilDate) break;
        if (maxCount && totalGenerated + results.length >= maxCount) break;
        if (results.length >= limit) break;

        const year = cursor.getUTCFullYear();
        const month = cursor.getUTCMonth();

        if (bySetpos != null && byWeekday.length > 0) {
          // Ordinal weekday: "first Monday", "last Friday", etc.
          for (const wd of byWeekday) {
            const d = nthWeekdayOfMonth(year, month, wd, bySetpos);
            if (!d) continue;
            if (d < dtstart || d > horizon) continue;
            if (untilDate && d > untilDate) continue;
            if (maxCount && totalGenerated + results.length >= maxCount) break;
            if (results.length >= limit) break;
            const ds = fmtDate(d);
            if ((!afterDate || d > afterDate) && !skipDates.has(ds)) {
              results.push(rescheduleDates.get(ds) ?? ds);
            }
          }
        } else if (byMonthday.length > 0) {
          // Specific days of month
          for (const md of byMonthday) {
            let day = md;
            if (day < 0) day = lastDayOfMonth(cursor) + day + 1; // -1 = last day
            if (day < 1 || day > lastDayOfMonth(cursor)) continue;
            const d = new Date(Date.UTC(year, month, day));
            if (d < dtstart || d > horizon) continue;
            if (untilDate && d > untilDate) continue;
            if (maxCount && totalGenerated + results.length >= maxCount) break;
            if (results.length >= limit) break;
            const ds = fmtDate(d);
            if ((!afterDate || d > afterDate) && !skipDates.has(ds)) {
              results.push(rescheduleDates.get(ds) ?? ds);
            }
          }
        } else {
          // Default: same day-of-month as dtstart
          const day = Math.min(dtstart.getUTCDate(), lastDayOfMonth(cursor));
          const d = new Date(Date.UTC(year, month, day));
          if (d >= dtstart && d <= horizon) {
            const ds = fmtDate(d);
            if ((!afterDate || d > afterDate) && !skipDates.has(ds)) {
              results.push(rescheduleDates.get(ds) ?? ds);
            }
          }
        }

        cursor = addMonths(cursor, interval);
        cursor.setUTCDate(1); // reset to 1st to avoid month overflow
      }
      break;

    case "yearly":
      cursor = new Date(dtstart);
      while (cursor <= horizon && iterCount < MAX_ITER) {
        iterCount++;
        if (untilDate && cursor > untilDate) break;
        if (maxCount && totalGenerated + results.length >= maxCount) break;
        if (results.length >= limit) break;

        const ds = fmtDate(cursor);
        if ((!afterDate || cursor > afterDate) && !skipDates.has(ds)) {
          results.push(rescheduleDates.get(ds) ?? ds);
        }
        cursor = addYears(cursor, interval);
      }
      break;
  }

  // Sort and deduplicate
  return [...new Set(results)].sort();
}

// ─── Validation ─────────────────────────────────────────────────────

export interface RecurrenceValidation {
  valid: boolean;
  errors: string[];
}

export function validateRecurrenceRule(series: Partial<TaskSeries>): RecurrenceValidation {
  const errors: string[] = [];

  if (!series.freq) errors.push("Frequency is required");
  if (!series.dtstart) errors.push("Start date is required");

  if (series.interval != null && series.interval < 1) {
    errors.push("Interval must be at least 1");
  }

  if (series.until_date && series.max_count) {
    errors.push("Cannot set both end date and occurrence count");
  }

  if (series.until_date && series.dtstart && series.until_date < series.dtstart) {
    errors.push("End date must be after start date");
  }

  if (series.recurrence_mode === "completion" && !series.completion_delay_days) {
    errors.push("Completion delay days required for completion-based recurrence");
  }

  if (series.by_weekday) {
    for (const wd of series.by_weekday) {
      if (wd < 0 || wd > 6) errors.push(`Invalid weekday value: ${wd} (must be 0-6)`);
    }
  }

  if (series.by_monthday) {
    for (const md of series.by_monthday) {
      if (md === 0 || md < -31 || md > 31) {
        errors.push(`Invalid monthday value: ${md}`);
      }
    }
  }

  if (series.by_setpos != null) {
    if (!series.by_weekday || series.by_weekday.length === 0) {
      errors.push("by_setpos requires at least one weekday in by_weekday");
    }
    if (series.freq !== "monthly" && series.freq !== "yearly") {
      errors.push("by_setpos only supported for monthly and yearly frequencies");
    }
  }

  if (series.max_count != null && series.max_count < 1) {
    errors.push("Occurrence count must be at least 1");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Next Occurrence Computation ────────────────────────────────────

/**
 * Compute the next occurrence date for a series, used to update
 * series.next_occurrence after generating instances.
 */
export function computeNextOccurrence(
  series: TaskSeries,
  exceptions?: SeriesException[]
): string | null {
  // If series is ended, return null
  if (series.max_count && series.generated_count >= series.max_count) return null;
  if (series.until_date) {
    const now = new Date().toISOString().slice(0, 10);
    if (series.until_date < now) return null;
  }

  // Generate next 1 occurrence after the last generated date
  const after = series.last_generated_date ?? undefined;
  const horizon = series.until_date ?? addYears(new Date(), 2).toISOString().slice(0, 10);

  const dates = generateOccurrences(series, {
    horizon,
    limit: 1,
    after,
    exceptions,
  });

  return dates[0] ?? null;
}

// ─── Human-readable description ─────────────────────────────────────

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_NAMES: Record<number, string> = {
  1: "first", 2: "second", 3: "third", 4: "fourth", "-1": "last", "-2": "second-to-last",
};

export function describeRecurrence(series: Partial<TaskSeries>): string {
  if (!series.freq) return "";

  const interval = series.interval ?? 1;
  const parts: string[] = [];

  if (series.recurrence_mode === "completion") {
    return `${series.completion_delay_days ?? 1} day(s) after completion`;
  }

  switch (series.freq) {
    case "daily":
      if (series.by_weekday && series.by_weekday.length > 0) {
        const days = series.by_weekday.map((d) => WEEKDAY_NAMES[d]).join(", ");
        parts.push(`Every ${days}`);
      } else if (interval === 1) {
        parts.push("Daily");
      } else {
        parts.push(`Every ${interval} days`);
      }
      break;

    case "weekly":
      if (series.by_weekday && series.by_weekday.length > 0) {
        const days = series.by_weekday.map((d) => WEEKDAY_NAMES[d]).join(", ");
        parts.push(interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`);
      } else {
        parts.push(interval === 1 ? "Weekly" : `Every ${interval} weeks`);
      }
      break;

    case "monthly":
      if (series.by_setpos != null && series.by_weekday && series.by_weekday.length > 0) {
        const ord = ORDINAL_NAMES[series.by_setpos] ?? `#${series.by_setpos}`;
        const day = WEEKDAY_NAMES[series.by_weekday[0]];
        parts.push(interval === 1 ? `Monthly on the ${ord} ${day}` : `Every ${interval} months on the ${ord} ${day}`);
      } else if (series.by_monthday && series.by_monthday.length > 0) {
        const days = series.by_monthday.map((d) => d === -1 ? "last day" : `day ${d}`).join(", ");
        parts.push(interval === 1 ? `Monthly on ${days}` : `Every ${interval} months on ${days}`);
      } else {
        parts.push(interval === 1 ? "Monthly" : `Every ${interval} months`);
      }
      break;

    case "yearly":
      parts.push(interval === 1 ? "Yearly" : `Every ${interval} years`);
      break;
  }

  if (series.until_date) {
    parts.push(`until ${series.until_date}`);
  } else if (series.max_count) {
    parts.push(`${series.max_count} times`);
  }

  return parts.join(", ");
}
