import { db } from "@/lib/db";

/**
 * Zoom über OAuth (Zoom Marketplace, "General App", user-managed).
 * Jeder Gastgeber verbindet sein Zoom-Konto einmal im Dashboard; danach legt die
 * App pro Buchung ein Zoom-Meeting an und löscht es bei Absage wieder.
 */
const API = "https://api.zoom.us/v2";
const OAUTH = "https://zoom.us/oauth";

export const zoomEnabled = () => !!process.env.ZOOM_CLIENT_ID && !!process.env.ZOOM_CLIENT_SECRET;

const basicAuth = () =>
  "Basic " + Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");

export function zoomRedirectUri(appUrl: string) {
  return `${appUrl}/api/integrations/zoom/callback`;
}

export function zoomAuthorizeUrl(appUrl: string, state: string) {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID ?? "",
    redirect_uri: zoomRedirectUri(appUrl),
    state,
  });
  return `${OAUTH}/authorize?${q}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { reason?: string; error?: string };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(`Zoom-Anmeldung fehlgeschlagen: ${json.reason ?? json.error ?? res.status}`);
  }
  return json as TokenResponse;
}

/** OAuth-Callback: Code gegen Tokens tauschen und Verbindung speichern. */
export async function connectZoom(userId: string, code: string, appUrl: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: zoomRedirectUri(appUrl) });
  const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then(
    (r) => r.json() as Promise<{ id?: string; email?: string }>,
  );
  const data = {
    zoomUserId: me.id ?? "me",
    email: me.email ?? null,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
  };
  return db.zoomConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

async function accessToken(userId: string) {
  const conn = await db.zoomConnection.findUnique({ where: { userId } });
  if (!conn) throw new ZoomNotConnected();
  if (conn.expiresAt.getTime() > Date.now() + 60_000) return conn.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken });
  await db.zoomConnection.update({
    where: { userId },
    data: { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) },
  });
  return t.access_token;
}

export class ZoomNotConnected extends Error {
  constructor() {
    super("Zoom ist für diesen Gastgeber nicht verbunden");
  }
}

export async function hasZoom(userId: string) {
  return !!(await db.zoomConnection.findUnique({ where: { userId }, select: { id: true } }));
}

/** Legt ein Zoom-Meeting an und liefert ID und Teilnahmelink. */
export async function createZoomMeeting(
  userId: string,
  input: { topic: string; start: Date; durationMin: number; timeZone: string; agenda?: string },
) {
  const res = await fetch(`${API}/users/me/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(userId)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      type: 2, // geplantes Meeting
      start_time: input.start.toISOString().replace(/\.\d{3}Z$/, "Z"),
      duration: input.durationMin,
      timezone: input.timeZone,
      agenda: input.agenda?.slice(0, 2000),
      settings: { join_before_host: false, waiting_room: true },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: number | string; join_url?: string; message?: string };
  if (!res.ok || !json.id || !json.join_url) throw new Error(`Zoom-Meeting konnte nicht angelegt werden: ${json.message ?? res.status}`);
  return { meetingId: String(json.id), joinUrl: json.join_url };
}

export async function deleteZoomMeeting(userId: string, meetingId: string) {
  const res = await fetch(`${API}/meetings/${encodeURIComponent(meetingId)}?schedule_for_reminder=false`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${await accessToken(userId)}` },
    signal: AbortSignal.timeout(10_000),
  });
  // 404: schon gelöscht
  if (!res.ok && res.status !== 404) throw new Error(`Zoom-Meeting konnte nicht gelöscht werden: ${res.status}`);
}

export async function disconnectZoom(userId: string) {
  const conn = await db.zoomConnection.findUnique({ where: { userId } });
  if (!conn) return;
  // Token bei Zoom widerrufen (Fehler ignorieren, lokal wird trotzdem getrennt)
  await fetch(`${OAUTH}/revoke`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: conn.refreshToken }),
  }).catch(() => {});
  await db.zoomConnection.delete({ where: { userId } });
}
