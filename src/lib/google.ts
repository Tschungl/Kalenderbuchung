import { google, type calendar_v3 } from "googleapis";
import { db } from "@/lib/db";
import type { Interval } from "@/lib/availability";

/** OAuth-Client für einen User, mit automatischer Token-Erneuerung und Speicherung. */
async function getAuthClient(userId: string) {
  const account = await db.account.findFirst({ where: { userId, provider: "google" } });
  if (!account?.refresh_token && !account?.access_token) {
    throw new Error(`Kein Google-Konto für User ${userId} verbunden`);
  }
  const client = new google.auth.OAuth2(process.env.AUTH_GOOGLE_ID, process.env.AUTH_GOOGLE_SECRET);
  client.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });
  client.on("tokens", async (tokens) => {
    await db.account.update({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
      data: {
        access_token: tokens.access_token ?? undefined,
        refresh_token: tokens.refresh_token ?? undefined,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
      },
    });
  });
  return client;
}

async function calendarFor(userId: string): Promise<calendar_v3.Calendar> {
  return google.calendar({ version: "v3", auth: await getAuthClient(userId) });
}

/** Belegt-Zeiten aus dem primären Google-Kalender. */
export async function getGoogleBusy(userId: string, timeMin: Date, timeMax: Date): Promise<Interval[]> {
  const calendar = await calendarFor(userId);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: "primary" }],
    },
  });
  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
}

export type CreateEventInput = {
  organizerUserId: string;
  calendarId?: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendees: { email: string; displayName?: string }[];
  withMeet: boolean;
  location?: string;
  requestId: string;
};

/** Legt den Termin im Kalender des Gastgebers an; Google verschickt die Einladungen. */
export async function createGoogleEvent(input: CreateEventInput) {
  const calendar = await calendarFor(input.organizerUserId);
  const res = await calendar.events.insert({
    calendarId: input.calendarId ?? "primary",
    sendUpdates: "all",
    conferenceDataVersion: input.withMeet ? 1 : 0,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
      attendees: input.attendees,
      conferenceData: input.withMeet
        ? { createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } }
        : undefined,
    },
  });
  const meetUrl =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  return { eventId: res.data.id ?? null, meetUrl };
}

export async function cancelGoogleEvent(userId: string, eventId: string, calendarId = "primary") {
  const calendar = await calendarFor(userId);
  await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });
}
