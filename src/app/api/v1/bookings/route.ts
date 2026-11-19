import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { loadEventTypeById } from "@/lib/slots";
import { withApiKey } from "@/lib/integrations/api";
import { bookingPayload } from "@/lib/integrations/webhooks";

const ListQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/v1/bookings?from=&to=&status=&limit= */
export const GET = withApiKey(async (req, org) => {
  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Parameter", issues: parsed.error.issues }, { status: 400 });
  const { from, to, status, limit } = parsed.data;
  const bookings = await db.booking.findMany({
    where: {
      organizationId: org.id,
      status,
      startTime: { gte: from, lt: to },
    },
    include: { attendees: true },
    orderBy: { startTime: "asc" },
    take: limit,
  });
  return NextResponse.json({ data: bookings.map(bookingPayload) });
});

const CreateBody = z.object({
  eventTypeId: z.string().min(1),
  start: z.coerce.date(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  timeZone: z.string().min(1).default("Europe/Berlin"),
  guests: z.array(z.string().trim().email()).max(20).default([]),
  notes: z.string().max(2000).optional(),
});

/** POST /api/v1/bookings  ->  bucht wie die Buchungsseite (mit allen Prüfungen) */
export const POST = withApiKey(async (req, org) => {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte Eingaben prüfen", issues: parsed.error.issues }, { status: 400 });
  const { eventTypeId, ...data } = parsed.data;
  const et = await loadEventTypeById(eventTypeId);
  if (!et || et.organizationId !== org.id || !et.active) {
    return NextResponse.json({ error: "Meeting-Typ nicht gefunden" }, { status: 404 });
  }
  const booking = await createBooking(et, data);
  const full = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { attendees: true } });
  return NextResponse.json({ data: bookingPayload(full) }, { status: 201 });
});
