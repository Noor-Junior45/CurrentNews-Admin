/**
 * Bulletproof date parser and formatter for Firestore timestamps, cached JSON objects,
 * ISO strings, unix seconds/milliseconds, and invalid values.
 * Completely eliminates any "RangeError: Invalid time value".
 */

export function safeParseDate(rawDate: any): Date | null {
  if (rawDate === null || rawDate === undefined) return null;

  try {
    // 1. Already a Date object or Date-like object from another realm/iframe
    if (rawDate instanceof Date || Object.prototype.toString.call(rawDate) === '[object Date]') {
      const time = rawDate.getTime();
      return isFinite(time) && !isNaN(time) ? rawDate : null;
    }

    // 2. Object with getTime function
    if (typeof rawDate.getTime === 'function') {
      const time = rawDate.getTime();
      if (isFinite(time) && !isNaN(time)) return new Date(time);
    }

    // 3. Firestore Timestamp instance with .toDate()
    if (typeof rawDate.toDate === 'function') {
      try {
        const d = rawDate.toDate();
        if (d && typeof d.getTime === 'function') {
          const time = d.getTime();
          if (isFinite(time) && !isNaN(time)) return new Date(time);
        }
      } catch {
        // Fall through to other properties
      }
    }

    // 4. Firestore Timestamp with .toMillis()
    if (typeof rawDate.toMillis === 'function') {
      try {
        const ms = rawDate.toMillis();
        if (typeof ms === 'number' && isFinite(ms) && !isNaN(ms)) {
          const d = new Date(ms);
          if (!isNaN(d.getTime())) return d;
        }
      } catch {
        // Fall through
      }
    }

    // 5. Serialized Firestore Timestamp object { seconds: ..., nanoseconds: ... } or { _seconds: ... }
    const rawSec = rawDate.seconds ?? rawDate._seconds;
    if (rawSec !== undefined && rawSec !== null) {
      const sec = typeof rawSec === 'number' ? rawSec : parseFloat(String(rawSec));
      if (isFinite(sec) && !isNaN(sec)) {
        // If it's already in milliseconds (> 10^11), don't multiply by 1000
        const ms = sec > 100000000000 ? sec : sec * 1000;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // 6. Firestore REST API format { timestampValue: "..." }
    if (typeof rawDate.timestampValue === 'string') {
      const d = new Date(rawDate.timestampValue);
      if (!isNaN(d.getTime()) && isFinite(d.getTime())) return d;
    }

    // 7. Unix timestamp in milliseconds or seconds as number
    if (typeof rawDate === 'number') {
      if (isFinite(rawDate) && !isNaN(rawDate)) {
        const ms = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
        const d = new Date(ms);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // 8. String format (ISO date string, UTC string, or numeric string)
    if (typeof rawDate === 'string') {
      const trimmed = rawDate.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'Invalid Date') return null;

      // Check if numeric string
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const num = parseFloat(trimmed);
        if (isFinite(num) && !isNaN(num)) {
          const ms = num < 10000000000 ? num * 1000 : num;
          const d = new Date(ms);
          if (!isNaN(d.getTime())) return d;
        }
      }

      const d = new Date(trimmed);
      if (!isNaN(d.getTime()) && isFinite(d.getTime())) return d;
    }
  } catch (err) {
    console.debug('safeParseDate encountered unparseable value:', rawDate, err);
  }

  return null;
}

export function safeFormatDate(
  rawDate: any,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
  fallback: string = 'Recent Post'
): string {
  try {
    const d = safeParseDate(rawDate);
    if (!d || isNaN(d.getTime()) || !isFinite(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', options);
  } catch {
    return fallback;
  }
}

export function safeToIsoString(rawDate: any, fallback?: string): string {
  try {
    const d = safeParseDate(rawDate);
    if (!d || isNaN(d.getTime()) || !isFinite(d.getTime())) {
      return fallback || new Date().toISOString();
    }
    return d.toISOString();
  } catch {
    return fallback || new Date().toISOString();
  }
}
