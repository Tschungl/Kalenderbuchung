import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, createBooking } from "@/lib/booking";
import { loadEventType } from "@/lib/slots";

const Body = z.object({
  org: z.string().min(1),
  event: z.string().min(1),
  start: z.coerce.date(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  timeZone: z.string().min(1).default("Europe/Berlin"),
  guests: z.array(z.string().trim().email()).max(20).default([]),
  notes: z.string().max(2000).optional(),
});

/** POST /api/bookings  ->  Termin buchen */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte Eingaben prüfen", issues: parsed.error.issues }, { status: 400 });
  }
  const { org, event, ...data } = parsed.data;
  const et = await loadEventType(org, event);
  if (!et) return NextResponse.json({ error: "Meeting-Typ nicht gefunden" }, { status: 404 });

  try {
    const booking = await createBooking(et, data);
    return NextResponse.json({
      id: booking.id,
      start: booking.startTime,
      end: booking.endTime,
      meetingUrl: booking.meetingUrl,
      manageToken: booking.manageToken,
    });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
