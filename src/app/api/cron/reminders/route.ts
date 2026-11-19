import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

/**
 * Optional für externe Cron-Dienste (z.B. wenn mehrere App-Instanzen laufen und
 * DISABLE_REMINDER_LOOP=1 gesetzt ist). Aufruf mit "Authorization: Bearer <CRON_SECRET>".
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const sent = await sendDueReminders();
  return NextResponse.json({ sent });
}
