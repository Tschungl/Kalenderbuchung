import { db } from "@/lib/db";
import type { Interval } from "@/lib/availability";
import { cancelGoogleEvent, createGoogleEvent, getGoogleBusy, type CreateEventInput } from "@/lib/google";
import { MS_PROVIDER, cancelMicrosoftEvent, createMicrosoftEvent, getMicrosoftBusy } from "@/lib/microsoft";

/**
 * Einheitliche Kalender-Schicht: entscheidet pro Gastgeber, ob Google oder
 * Microsoft 365 benutzt wird (je nachdem, womit er sich angemeldet hat).
 */
export type CalendarProvider = "google" | "microsoft";

/**
 * Demo-Modus (DEMO_CALENDAR=1): kein echter Kalender nötig. Es gibt feste "belegte"
 * Blöcke, Buchungen bekommen einen Beispiel-Videolink. Nur für Vorführungen und Tests.
 */
export const demoCalendar = () => process.env.DEMO_CALENDAR === "1";

export function demoBusy(from: Date, to: Date): Interval[] {
  const busy: Interval[] = [];
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (; day < to; day.setUTCDate(day.getUTCDate() + 1)) {
    const d = day.getUTCDate();
    const at = (h: number, m = 0) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), d, h, m));
    // Mittagspause und je nach Tag ein bis zwei Termine (Zeiten in UTC, Berlin = +1 h im Winter)
    busy.push({ start: at(11), end: at(12) });
    if (d % 2 === 0) busy.push({ start: at(8), end: at(9, 30) });
    if (d % 3 === 0) busy.push({ start: at(13, 30), end: at(15) });
  }
  return busy.filter((b) => b.end > from && b.start < to);
}

export async function providerFor(userId: string): Promise<CalendarProvider> {
  const accounts = await db.account.findMany({ where: { userId }, select: { provider: true } });
  if (accounts.some((a) => a.provider === "google")) return "google";
  if (accounts.some((a) => a.provider === MS_PROVIDER)) return "microsoft";
  return "google";
}

export async function getBusy(userId: string, from: Date, to: Date): Promise<Interval[]> {
  if (demoCalendar()) return demoBusy(from, to);
  return (await providerFor(userId)) === "microsoft" ? getMicrosoftBusy(userId, from, to) : getGoogleBusy(userId, from, to);
}

export async function createCalendarEvent(input: CreateEventInput) {
  if (demoCalendar()) {
    const code = input.requestId.replace(/[^a-z]/g, "").slice(0, 10).padEnd(10, "x");
    return { eventId: `demo-${input.requestId}`, meetUrl: input.withMeet ? `https://meet.google.com/${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7, 10)}` : null, provider: "google" as const };
  }
  const provider = await providerFor(input.organizerUserId);
  const result = provider === "microsoft" ? await createMicrosoftEvent(input) : await createGoogleEvent(input);
  return { ...result, provider };
}

export async function cancelCalendarEvent(userId: string, eventId: string, provider: string) {
  if (demoCalendar() || eventId.startsWith("demo-")) return;
  if (provider === "microsoft") return cancelMicrosoftEvent(userId, eventId);
  return cancelGoogleEvent(userId, eventId);
}

export const PROVIDER_LABEL: Record<string, string> = { google: "Google Kalender", microsoft: "Outlook / Microsoft 365" };
