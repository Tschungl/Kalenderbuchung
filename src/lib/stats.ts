/** Reine Auswertungsfunktionen für das Statistik-Dashboard (getestet). */

export type StatBooking = {
  id: string;
  status: "CONFIRMED" | "CANCELLED";
  startTime: Date;
  eventTypeId: string;
  hostId: string;
  rescheduledFromId: string | null;
};

export type StatNegotiation = { status: string };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function weekdayIndex(d: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(d);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name);
}
function hourOf(d: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(d));
}

export function computeStats(bookings: StatBooking[], negotiations: StatNegotiation[], timeZone = "Europe/Berlin") {
  // Ersetzte (verschobene) Buchungen zählen nicht als Absage
  const replaced = new Set(bookings.map((b) => b.rescheduledFromId).filter(Boolean) as string[]);
  const original = bookings.filter((b) => !b.rescheduledFromId);
  const cancelled = bookings.filter((b) => b.status === "CANCELLED" && !replaced.has(b.id));
  const active = bookings.filter((b) => b.status === "CONFIRMED");

  const count = <K extends string>(items: StatBooking[], key: (b: StatBooking) => K) => {
    const m = new Map<K, number>();
    for (const b of items) m.set(key(b), (m.get(key(b)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byWeekday = WEEKDAYS.map((label, i) => ({
    label,
    value: active.filter((b) => weekdayIndex(b.startTime, timeZone) === i).length,
  }));
  const hours = new Map<number, number>();
  for (const b of active) hours.set(hourOf(b.startTime, timeZone), (hours.get(hourOf(b.startTime, timeZone)) ?? 0) + 1);
  const byHour = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, value]) => ({ label: `${String(h).padStart(2, "0")} Uhr`, value }));

  const negBooked = negotiations.filter((n) => n.status === "BOOKED").length;
  return {
    booked: original.length,
    active: active.length,
    cancelled: cancelled.length,
    rescheduled: bookings.length - original.length,
    cancelRate: original.length ? cancelled.length / original.length : 0,
    byEventType: count(active, (b) => b.eventTypeId),
    byHost: count(active, (b) => b.hostId),
    byWeekday,
    byHour,
    negotiations: {
      total: negotiations.length,
      booked: negBooked,
      waiting: negotiations.filter((n) => n.status === "AWAITING_APPROVAL").length,
      successRate: negotiations.length ? negBooked / negotiations.length : 0,
    },
  };
}
