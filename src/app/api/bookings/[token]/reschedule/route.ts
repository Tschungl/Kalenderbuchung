import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, rescheduleBooking } from "@/lib/booking";

const Body = z.object({ start: z.coerce.date() });

/** POST /api/bookings/:token/reschedule  { start }  ->  Termin per Verwaltungslink verschieben */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Zeit" }, { status: 400 });
  try {
    const booking = await rescheduleBooking((await params).token, parsed.data.start);
    return NextResponse.json({
      start: booking.startTime,
      meetingUrl: booking.meetingUrl,
      manageToken: booking.manageToken,
    });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
