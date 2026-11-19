import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { pickRoundRobinHost } from "@/lib/availability";
import { cancelGoogleEvent, createGoogleEvent } from "@/lib/google";
import { formatDateTime, sendMail } from "@/lib/mail";
import { getSlotsForEventType, type LoadedEventType } from "@/lib/slots";
import type { NegotiationRules } from "@/lib/negotiation/rules";
import { bookingPayload, emitWebhook } from "@/lib/integrations/webhooks";

export class BookingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type BookingRequest = {
  start: Date;
  name: string;
  email: string;
  timeZone: string;
  guests: string[];
  notes?: string;
};

export async function createBooking(
  et: LoadedEventType,
  req: BookingRequest,
  opts: { rules?: NegotiationRules } = {},
) {
  if (req.guests.length > et.maxGuests) {
    throw new BookingError(`Maximal ${et.maxGuests} weitere Gäste erlaubt.`);
  }
  const end = new Date(req.start.getTime() + et.durationMin * 60_000);

  // Slot serverseitig erneut prüfen (der Kalender kann sich seit dem Laden der Seite geändert haben)
  const slots = await getSlotsForEventType(et, req.start, end, opts);
  const slot = slots.find((s) => s.start.getTime() === req.start.getTime());
  if (!slot) throw new BookingError("Dieser Termin ist leider nicht mehr frei.", 409);

  // Gastgeber bestimmen
  let organizerId: string;
  let coHostIds: string[] = [];
  if (et.mode === "ROUND_ROBIN") {
    const counts = await db.booking.groupBy({
      by: ["hostId"],
      where: { eventTypeId: et.id, status: "CONFIRMED", hostId: { in: slot.hostIds } },
      _count: true,
    });
    const picked = pickRoundRobinHost(
      slot.hostIds.map((id) => ({
        id,
        weight: et.hosts.find((h) => h.userId === id)?.weight ?? 1,
        bookingCount: counts.find((c) => c.hostId === id)?._count ?? 0,
      })),
    );
    if (!picked) throw new BookingError("Kein Gastgeber verfügbar.", 409);
    organizerId = picked;
  } else {
    [organizerId, ...coHostIds] = slot.hostIds;
  }

  const organizer = et.hosts.find((h) => h.userId === organizerId)!.user;
  const coHosts = et.hosts.filter((h) => coHostIds.includes(h.userId)).map((h) => h.user);

  // Doppelbuchung im selben Moment verhindern
  const booking = await db.$transaction(async (tx) => {
    const clash = await tx.booking.findFirst({
      where: { hostId: organizerId, status: "CONFIRMED", startTime: { lt: end }, endTime: { gt: req.start } },
    });
    if (clash) throw new BookingError("Dieser Termin wurde gerade vergeben.", 409);
    return tx.booking.create({
      data: {
        organizationId: et.organizationId,
        eventTypeId: et.id,
        hostId: organizerId,
        startTime: req.start,
        endTime: end,
        notes: req.notes,
        attendees: {
          create: [
            { name: req.name, email: req.email, timeZone: req.timeZone },
            ...req.guests.map((g) => ({ name: g, email: g, timeZone: req.timeZone, isGuest: true })),
          ],
        },
      },
    });
  });

  // Google-Event anlegen; schlägt das fehl, Buchung zurückrollen
  try {
    const { eventId, meetUrl } = await createGoogleEvent({
      organizerUserId: organizerId,
      calendarId: organizer.targetCalendarId,
      summary: `${et.title}: ${req.name}`,
      description: [req.notes, `Verwalten: ${appUrl()}/booking/${booking.manageToken}`].filter(Boolean).join("\n\n"),
      start: req.start,
      end,
      timeZone: organizer.timeZone,
      attendees: [
        { email: req.email, displayName: req.name },
        ...req.guests.map((email) => ({ email })),
        ...coHosts.filter((u) => u.email).map((u) => ({ email: u.email!, displayName: u.name ?? undefined })),
      ],
      withMeet: et.locationType === "GOOGLE_MEET",
      location: et.locationType === "GOOGLE_MEET" ? undefined : et.locationValue ?? undefined,
      requestId: randomUUID(),
    });
    await db.booking.update({ where: { id: booking.id }, data: { googleEventId: eventId, meetingUrl: meetUrl } });
    booking.googleEventId = eventId;
    booking.meetingUrl = meetUrl;
  } catch (err) {
    await db.booking.delete({ where: { id: booking.id } });
    console.error("[booking] Google-Event konnte nicht angelegt werden", err);
    throw new BookingError("Der Termin konnte nicht im Kalender eingetragen werden. Bitte später erneut versuchen.", 502);
  }

  const when = formatDateTime(req.start, req.timeZone);
  await sendMail(
    req.email,
    `Bestätigt: ${et.title} am ${when}`,
    [
      `Hallo ${req.name},`,
      ``,
      `dein Termin "${et.title}" mit ${organizer.name ?? et.organization.name} ist bestätigt.`,
      `Wann: ${when}`,
      booking.meetingUrl ? `Video: ${booking.meetingUrl}` : et.locationValue ? `Ort: ${et.locationValue}` : "",
      ``,
      `Absagen: ${appUrl()}/booking/${booking.manageToken}`,
    ].join("\n"),
  ).catch((err) => console.error("[booking] Bestätigungsmail fehlgeschlagen", err));

  await emitWebhook(et.organizationId, "booking.created", {
    ...bookingPayload({
      ...booking,
      attendees: [
        { name: req.name, email: req.email, isGuest: false },
        ...req.guests.map((g) => ({ name: g, email: g, isGuest: true })),
      ],
    }),
    eventTypeSlug: et.slug,
  });

  return booking;
}

export async function cancelBooking(manageToken: string) {
  const booking = await db.booking.findUnique({ where: { manageToken }, include: { eventType: true, attendees: true } });
  if (!booking) throw new BookingError("Buchung nicht gefunden.", 404);
  if (booking.status === "CANCELLED") return booking;
  if (booking.googleEventId) {
    await cancelGoogleEvent(booking.hostId, booking.googleEventId).catch((err) =>
      console.error("[booking] Google-Event konnte nicht gelöscht werden", err),
    );
  }
  const cancelled = await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  await emitWebhook(booking.organizationId, "booking.cancelled", bookingPayload({ ...cancelled, attendees: booking.attendees }));
  return cancelled;
}

export function appUrl() {
  return (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
