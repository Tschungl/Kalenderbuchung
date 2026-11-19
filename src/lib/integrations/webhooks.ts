import { createHmac, randomBytes } from "crypto";
import { db } from "@/lib/db";

export const WEBHOOK_EVENTS = ["booking.created", "booking.cancelled", "negotiation.approval_requested"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  "booking.created": "Termin gebucht",
  "booking.cancelled": "Termin abgesagt",
  "negotiation.approval_requested": "Freigabe für Ausnahmezeit angefragt",
};

export function newWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/** Signatur-Header: "t=<unix>,v1=<hex>" mit HMAC-SHA256 über "<t>.<body>" (Schutz vor Wiederholung). */
export function signPayload(secret: string, body: string, timestamp: number) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

/** Nur öffentliche http(s)-Adressen; interne Ziele (localhost, private Netze) sind gesperrt. */
export function isAllowedWebhookUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return false;
  const host = url.hostname.toLowerCase();
  if (process.env.NODE_ENV === "production") {
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host === "[::1]" || host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) return false;
  }
  return true;
}

type BookingForPayload = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  meetingUrl: string | null;
  notes: string | null;
  hostId: string;
  eventTypeId: string;
  attendees?: { name: string; email: string; isGuest: boolean }[];
};

export function bookingPayload(b: BookingForPayload) {
  return {
    id: b.id,
    eventTypeId: b.eventTypeId,
    hostId: b.hostId,
    start: b.startTime.toISOString(),
    end: b.endTime.toISOString(),
    status: b.status,
    meetingUrl: b.meetingUrl,
    notes: b.notes,
    attendees: (b.attendees ?? []).map((a) => ({ name: a.name, email: a.email, isGuest: a.isGuest })),
  };
}

/**
 * Löst ein Ereignis für alle passenden Webhooks der Organisation aus.
 * Fehler werden protokolliert, aber nie an den Aufrufer weitergereicht:
 * eine kaputte Kunden-URL darf keine Buchung verhindern.
 */
export async function emitWebhook(organizationId: string, event: WebhookEvent, data: unknown) {
  try {
    const hooks = await db.webhook.findMany({ where: { organizationId, active: true, events: { has: event } } });
    await Promise.all(hooks.map((h) => deliverWebhook(h, event, data)));
  } catch (err) {
    console.error("[webhook] Auslösen fehlgeschlagen", err);
  }
}

export async function deliverWebhook(hook: { id: string; url: string; secret: string }, event: string, data: unknown) {
  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data });
  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    if (!isAllowedWebhookUrl(hook.url)) throw new Error("Ziel-URL nicht erlaubt");
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Kalenderbuchung-Webhook/1",
        "X-Kalender-Event": event,
        "X-Kalender-Signature": signPayload(hook.secret, body, Math.floor(Date.now() / 1000)),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    statusCode = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  await db.webhookDelivery
    .create({ data: { webhookId: hook.id, event, statusCode, error: error?.slice(0, 500) } })
    .catch(() => {});
}
