import { NextResponse } from "next/server";
import { BookingError, cancelBooking } from "@/lib/booking";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await cancelBooking(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
