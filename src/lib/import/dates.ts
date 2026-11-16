/**
 * Reads dates the way GHL exports them (e.g. "Created (EST)") and converts
 * them to an exact moment in time. GHL shows wall-clock times in the account's
 * time zone, so "2024-03-05 14:30" in New York is turned into the right UTC time.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

function to24h(h: number, ampm?: string): number {
  if (!ampm) return h;
  const pm = ampm.toLowerCase() === "pm";
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

function parseParts(input: string): Parts | null {
  const s = input.trim().replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;

  // 2024-03-05, 2024-03-05 14:30, 2024-03-05T14:30:00
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/))) {
    return { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  }
  // 03/05/2024, 03/05/2024 2:30 PM, 3/5/2024, 14:30
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?)?$/))) {
    return { y: +m[3], m: +m[1], d: +m[2], h: to24h(+(m[4] ?? 0), m[7]), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  }
  // Mar 05 2024 02:30 PM, Mar 5, 2024 2:30 pm, March 5 2024
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})(?:,? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?)?$/))) {
    const month = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (!month) return null;
    return { y: +m[3], m: month, d: +m[2], h: to24h(+(m[4] ?? 0), m[7]), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  }
  return null;
}

function valid(p: Parts): boolean {
  if (p.y < 1990 || p.y > 2100 || p.m < 1 || p.m > 12 || p.h > 23 || p.mi > 59 || p.s > 59) return false;
  const dim = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  return p.d >= 1 && p.d <= dim;
}

/** How far ahead of UTC a time zone is at a given moment, in milliseconds. */
function zoneOffset(utcMs: number, timeZone: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const get = (t: string) => Number(f.formatToParts(new Date(utcMs)).find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** Returns an ISO date-time (UTC), or null if the text isn't a recognisable date. */
export function parseGhlDate(input: unknown, timeZone = "America/New_York"): string | null {
  if (typeof input !== "string" || input.trim() === "") return null;
  const text = input.trim();

  // Already has a time zone (e.g. 2024-03-05T14:30:00Z or +02:00): trust it.
  if (/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const ms = Date.parse(text);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }

  const p = parseParts(text);
  if (!p || !valid(p)) return null;
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  // Two passes handle daylight-saving changes correctly.
  let utc = wall - zoneOffset(wall, timeZone);
  utc = wall - zoneOffset(utc, timeZone);
  return new Date(utc).toISOString();
}
