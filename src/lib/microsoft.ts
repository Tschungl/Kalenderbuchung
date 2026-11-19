import { db } from "@/lib/db";
import type { Interval } from "@/lib/availability";
import type { CreateEventInput } from "@/lib/google";

/**
 * Microsoft 365 / Outlook über Microsoft Graph.
 * Der Login läuft über Auth.js (Provider "microsoft-entra-id"); hier werden die
 * gespeicherten Tokens benutzt und bei Bedarf erneuert.
 */
export const MS_PROVIDER = "microsoft-entra-id";
const GRAPH = "https://graph.microsoft.com/v1.0";

function tenant() {
  const m = /microsoftonline\.com\/([^/]+)\/v2\.0/.exec(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "");
  return m?.[1] ?? "common";
}

async function accessToken(userId: string) {
  const account = await db.account.findFirst({ where: { userId, provider: MS_PROVIDER } });
  if (!account) throw new Error(`Kein Microsoft-Konto für User ${userId} verbunden`);
  const valid = account.access_token && account.expires_at && account.expires_at * 1000 > Date.now() + 60_000;
  if (valid) return account.access_token!;
  if (!account.refresh_token) throw new Error("Microsoft-Anmeldung abgelaufen, bitte neu anmelden");

  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope: MS_SCOPES,
    }),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Microsoft-Token konnte nicht erneuert werden: ${json.error_description ?? res.status}`);
  await db.account.update({
    where: { provider_providerAccountId: { provider: MS_PROVIDER, providerAccountId: account.providerAccountId } },
    data: {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? account.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    },
  });
  return json.access_token;
}

export const MS_SCOPES = "openid profile email offline_access User.Read Calendars.ReadWrite";

async function graph<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken(userId)}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Graph ${init.method ?? "GET"} ${path}: ${res.status} ${text.slice(0, 300)}`), { status: res.status });
  }
  return (res.status === 202 || res.status === 204 ? undefined : await res.json()) as T;
}

/** Graph liefert UTC-Zeiten ohne "Z". */
const utc = (s: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);

type CalendarViewItem = { showAs?: string; isCancelled?: boolean; start: { dateTime: string }; end: { dateTime: string } };

/** Belegt-Zeiten aus dem Outlook-Kalender (alles außer "frei"). */
export async function getMicrosoftBusy(userId: string, timeMin: Date, timeMax: Date): Promise<Interval[]> {
  const busy: Interval[] = [];
  let path: string | null =
    `/me/calendarView?startDateTime=${encodeURIComponent(timeMin.toISOString())}` +
    `&endDateTime=${encodeURIComponent(timeMax.toISOString())}&$select=showAs,isCancelled,start,end&$top=200`;
  for (let page = 0; path && page < 10; page++) {
    const res: { value: CalendarViewItem[]; "@odata.nextLink"?: string } = await graph(userId, path);
    for (const e of res.value) {
      if (e.isCancelled || e.showAs === "free" || e.showAs === "workingElsewhere") continue;
      busy.push({ start: utc(e.start.dateTime), end: utc(e.end.dateTime) });
    }
    path = res["@odata.nextLink"]?.replace(GRAPH, "") ?? null;
  }
  return busy;
}

type GraphEvent = { id: string; onlineMeeting?: { joinUrl?: string } | null; webLink?: string };

/** Termin im Outlook-Kalender anlegen; Outlook verschickt die Einladungen. Mit Video = Teams-Link. */
export async function createMicrosoftEvent(input: CreateEventInput) {
  const body = (online: boolean) =>
    JSON.stringify({
      subject: input.summary,
      body: { contentType: "text", content: input.description ?? "" },
      start: { dateTime: input.start.toISOString().replace("Z", ""), timeZone: "UTC" },
      end: { dateTime: input.end.toISOString().replace("Z", ""), timeZone: "UTC" },
      location: input.location ? { displayName: input.location } : undefined,
      attendees: input.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.displayName }, type: "required" })),
      isOnlineMeeting: online,
      onlineMeetingProvider: online ? "teamsForBusiness" : undefined,
      transactionId: input.requestId,
    });
  const calendarPath = input.calendarId && input.calendarId !== "primary" ? `/me/calendars/${input.calendarId}/events` : "/me/events";
  let event: GraphEvent;
  try {
    event = await graph<GraphEvent>(input.organizerUserId, calendarPath, { method: "POST", body: body(input.withMeet) });
  } catch (err) {
    // Private Microsoft-Konten können keine Teams-Besprechungen anlegen: dann ohne Online-Meeting
    if (!input.withMeet || (err as { status?: number }).status !== 400) throw err;
    event = await graph<GraphEvent>(input.organizerUserId, calendarPath, { method: "POST", body: body(false) });
  }
  return { eventId: event.id, meetUrl: event.onlineMeeting?.joinUrl ?? null };
}

export async function cancelMicrosoftEvent(userId: string, eventId: string) {
  await graph(userId, `/me/events/${encodeURIComponent(eventId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ comment: "Der Termin wurde abgesagt." }),
  });
}
