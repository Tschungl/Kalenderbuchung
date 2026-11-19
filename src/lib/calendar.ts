import { db } from "@/lib/db";
import type { Interval } from "@/lib/availability";
import { cancelGoogleEvent, createGoogleEvent, getGoogleBusy, type CreateEventInput } from "@/lib/google";
import { MS_PROVIDER, cancelMicrosoftEvent, createMicrosoftEvent, getMicrosoftBusy } from "@/lib/microsoft";

/**
 * Einheitliche Kalender-Schicht: entscheidet pro Gastgeber, ob Google oder
 * Microsoft 365 benutzt wird (je nachdem, womit er sich angemeldet hat).
 */
export type CalendarProvider = "google" | "microsoft";

export async function providerFor(userId: string): Promise<CalendarProvider> {
  const accounts = await db.account.findMany({ where: { userId }, select: { provider: true } });
  if (accounts.some((a) => a.provider === "google")) return "google";
  if (accounts.some((a) => a.provider === MS_PROVIDER)) return "microsoft";
  return "google";
}

export async function getBusy(userId: string, from: Date, to: Date): Promise<Interval[]> {
  return (await providerFor(userId)) === "microsoft" ? getMicrosoftBusy(userId, from, to) : getGoogleBusy(userId, from, to);
}

export async function createCalendarEvent(input: CreateEventInput) {
  const provider = await providerFor(input.organizerUserId);
  const result = provider === "microsoft" ? await createMicrosoftEvent(input) : await createGoogleEvent(input);
  return { ...result, provider };
}

export async function cancelCalendarEvent(userId: string, eventId: string, provider: string) {
  if (provider === "microsoft") return cancelMicrosoftEvent(userId, eventId);
  return cancelGoogleEvent(userId, eventId);
}

export const PROVIDER_LABEL: Record<string, string> = { google: "Google Kalender", microsoft: "Outlook / Microsoft 365" };
