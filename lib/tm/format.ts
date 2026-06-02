// Shared date/time helpers for the TM portal.

const STOCKHOLM_TZ = "Europe/Stockholm";

// Stockholm calendar-date key (YYYY-MM-DD). Operators are in Sweden, so UTC
// midnight would mis-slice the day. Shared by /api/tm/stats and /api/tm/worklist.
export function stockholmDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ISO instant for the start (00:00) of the current Stockholm calendar day.
// Used by the worklist to decide which meetings count as "today / upcoming".
export function startOfTodayStockholmIso(now: Date = new Date()): string {
  const key = stockholmDateKey(now); // YYYY-MM-DD in Stockholm
  // Determine Stockholm's UTC offset for this date by formatting a probe.
  const probe = new Date(`${key}T00:00:00Z`);
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: STOCKHOLM_TZ,
    timeZoneName: "shortOffset",
  })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT+2"
  const m = tzName?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  const offsetHours = m ? parseInt(m[1], 10) : 0;
  const offsetMins = m && m[2] ? parseInt(m[2], 10) : 0;
  const sign = offsetHours < 0 ? -1 : 1;
  const totalOffsetMin = offsetHours * 60 + sign * offsetMins;
  // Local midnight in Stockholm == UTC midnight minus the offset.
  return new Date(probe.getTime() - totalOffsetMin * 60_000).toISOString();
}

const DATE_TIME_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TZ,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TZ,
  day: "2-digit",
  month: "2-digit",
});

// Human-readable Stockholm-local date+time, e.g. "03/06 09:00".
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DATE_TIME_FMT.format(d);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DATE_FMT.format(d);
}

// Bridge an ISO timestamptz to the value an <input type="datetime-local"> wants
// ("YYYY-MM-DDTHH:mm"). datetime-local is timezone-naive and shows wall-clock in
// the browser's local zone, so we derive the local wall-clock components here.
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Inverse of toDatetimeLocalValue: a datetime-local string is browser-local
// wall-clock; new Date(local) interprets it in the local zone, so toISOString()
// gives the correct instant to store. Empty string => null (clear the field).
export function fromDatetimeLocalValue(local: string | null | undefined): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// True when a callback time has already passed (overdue).
export function isOverdue(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() <= now.getTime();
}
