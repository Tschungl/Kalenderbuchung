/**
 * Verfügbarkeits-Engine.
 *
 * Reine Funktionen ohne Datenbank- oder Google-Zugriff, damit sie gut testbar sind
 * und später auch vom KI-Verhandlungs-Agenten genutzt werden können.
 */
import { fromZonedTime } from "date-fns-tz";

export type Interval = { start: Date; end: Date };
export type TimeRange = { start: string; end: string }; // "HH:mm"
/** Schlüssel "1".."7" = Montag..Sonntag */
export type WeeklyHours = Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7", TimeRange[]>>;
export type DateOverride = { date: string; intervals: TimeRange[] }; // date = "YYYY-MM-DD"

export type HostAvailabilityInput = {
  id: string;
  timeZone: string;
  weekly: WeeklyHours;
  overrides?: DateOverride[];
  /** Belegte Zeiten (Google freeBusy + bestehende Buchungen) */
  busy: Interval[];
  /** Nur für Round Robin: optional, Pflicht-Gastgeber bei Kollektiv */
  required?: boolean;
};

export type SchedulingMode = "SINGLE" | "COLLECTIVE" | "ROUND_ROBIN";

export type SlotQuery = {
  hosts: HostAvailabilityInput[];
  mode: SchedulingMode;
  durationMin: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  minNoticeMin?: number;
  maxDaysAhead?: number;
  stepMin?: number;
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
};

export type Slot = { start: Date; end: Date; hostIds: string[] };

export const DEFAULT_WEEKLY: WeeklyHours = {
  "1": [{ start: "09:00", end: "17:00" }],
  "2": [{ start: "09:00", end: "17:00" }],
  "3": [{ start: "09:00", end: "17:00" }],
  "4": [{ start: "09:00", end: "17:00" }],
  "5": [{ start: "09:00", end: "17:00" }],
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeekday(date: string): "1" | "2" | "3" | "4" | "5" | "6" | "7" {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sonntag
  return String(day === 0 ? 7 : day) as "1";
}

function dateInZone(instant: Date, timeZone: string): string {
  // en-CA liefert YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Arbeitszeiten eines Gastgebers als absolute Intervalle im gewünschten Zeitraum. */
export function workingIntervals(
  host: Pick<HostAvailabilityInput, "timeZone" | "weekly" | "overrides">,
  rangeStart: Date,
  rangeEnd: Date,
): Interval[] {
  const result: Interval[] = [];
  const overrides = new Map((host.overrides ?? []).map((o) => [o.date, o.intervals]));
  let date = addDaysToDateString(dateInZone(rangeStart, host.timeZone), -1);
  const lastDate = addDaysToDateString(dateInZone(rangeEnd, host.timeZone), 1);

  while (date <= lastDate) {
    const ranges = overrides.get(date) ?? host.weekly[isoWeekday(date)] ?? [];
    for (const r of ranges) {
      const start = fromZonedTime(`${date}T${r.start}:00`, host.timeZone);
      const end = fromZonedTime(`${date}T${r.end}:00`, host.timeZone);
      if (end > start && end > rangeStart && start < rangeEnd) {
        result.push({ start, end });
      }
    }
    date = addDaysToDateString(date, 1);
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function isHostFree(
  host: HostAvailabilityInput,
  working: Interval[],
  slot: Interval,
  bufferBeforeMin: number,
  bufferAfterMin: number,
): boolean {
  const insideWorking = working.some((w) => w.start <= slot.start && slot.end <= w.end);
  if (!insideWorking) return false;
  const padded: Interval = {
    start: new Date(slot.start.getTime() - bufferBeforeMin * MIN),
    end: new Date(slot.end.getTime() + bufferAfterMin * MIN),
  };
  return !host.busy.some((b) => overlaps(b, padded));
}

/** Berechnet buchbare Slots für einen Meeting-Typ. */
export function computeSlots(q: SlotQuery): Slot[] {
  const now = q.now ?? new Date();
  const step = Math.max(5, q.stepMin ?? 15);
  const duration = q.durationMin;
  const bufferBefore = q.bufferBeforeMin ?? 0;
  const bufferAfter = q.bufferAfterMin ?? 0;

  const earliest = new Date(
    Math.max(q.rangeStart.getTime(), now.getTime() + (q.minNoticeMin ?? 0) * MIN),
  );
  const latest = new Date(
    Math.min(q.rangeEnd.getTime(), now.getTime() + (q.maxDaysAhead ?? 60) * DAY),
  );
  if (latest <= earliest || q.hosts.length === 0) return [];

  const hosts = q.mode === "SINGLE" ? q.hosts.slice(0, 1) : q.hosts;
  const working = new Map(hosts.map((h) => [h.id, workingIntervals(h, earliest, latest)]));

  // Startzeiten am Raster ausrichten (z.B. :00, :15, :30, :45)
  const stepMs = step * MIN;
  let t = Math.ceil(earliest.getTime() / stepMs) * stepMs;
  const slots: Slot[] = [];

  for (; t + duration * MIN <= latest.getTime(); t += stepMs) {
    const slot: Interval = { start: new Date(t), end: new Date(t + duration * MIN) };
    const free = hosts.filter((h) =>
      isHostFree(h, working.get(h.id)!, slot, bufferBefore, bufferAfter),
    );

    if (q.mode === "COLLECTIVE") {
      const required = hosts.filter((h) => h.required !== false);
      const allRequiredFree = required.every((r) => free.includes(r));
      if (allRequiredFree && free.length > 0) {
        slots.push({ ...slot, hostIds: free.map((h) => h.id) });
      }
    } else if (free.length > 0) {
      slots.push({ ...slot, hostIds: free.map((h) => h.id) });
    }
  }
  return slots;
}

/**
 * Round Robin: wählt aus den freien Gastgebern den mit der geringsten
 * gewichteten Anzahl bisheriger Buchungen.
 */
export function pickRoundRobinHost(
  candidates: { id: string; weight: number; bookingCount: number }[],
): string | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) =>
      a.bookingCount / Math.max(1, a.weight) - b.bookingCount / Math.max(1, b.weight) ||
      a.id.localeCompare(b.id),
  );
  return sorted[0].id;
}
