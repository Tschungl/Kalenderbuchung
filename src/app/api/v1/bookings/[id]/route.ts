import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cancelBooking } from "@/lib/booking";
import { withApiKey } from "@/lib/integrations/api";
import { bookingPayload } from "@/lib/integrations/webhooks";

type Ctx = { params: Promise<{ id: string }> };

async function find(orgId: string, id: string) {
  return db.booking.findFirst({ where: { id, organizationId: orgId }, include: { attendees: true } });
}

/** GET /api/v1/bookings/:id */
export const GET = withApiKey<Ctx>(async (_req, org, { params }) => {
  const booking = await find(org.id, (await params).id);
  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  return NextResponse.json({ data: bookingPayload(booking) });
});

/** DELETE /api/v1/bookings/:id  ->  absagen (Kalender-Event wird mitgelöscht) */
export const DELETE = withApiKey<Ctx>(async (_req, org, { params }) => {
  const booking = await find(org.id, (await params).id);
  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden" }, { status: 404 });
  await cancelBooking(booking.manageToken);
  const updated = await find(org.id, booking.id);
  return NextResponse.json({ data: bookingPayload(updated!) });
});
