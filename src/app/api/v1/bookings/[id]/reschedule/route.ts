import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rescheduleBooking } from "@/lib/booking";
import { withApiKey } from "@/lib/integrations/api";
import { bookingPayload } from "@/lib/integrations/webhooks";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ start: z.coerce.date() });

/** POST /api/v1/bookings/:id/reschedule  { start }  ->  neue Buchung (die alte wird abgesagt) */
export const POST = withApiKey<Ctx>(async (req, org, { params }) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Zeit" }, { status: 400 });
  const old = await db.booking.findFirst({ where: { id: (await params).id, organizationId: org.id } });
  if (!old) return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  const created = await rescheduleBooking(old.manageToken, parsed.data.start);
  const full = await db.booking.findUniqueOrThrow({ where: { id: created.id }, include: { attendees: true } });
  return NextResponse.json({ data: { ...bookingPayload(full), rescheduledFromId: old.id } }, { status: 201 });
});
