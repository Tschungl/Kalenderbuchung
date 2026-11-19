import { NextResponse } from "next/server";
import { z } from "zod";
import { getSlotsForEventType, loadEventType } from "@/lib/slots";

const Query = z.object({
  org: z.string().min(1),
  event: z.string().min(1),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

/** GET /api/slots?org=...&event=...&from=ISO&to=ISO  ->  freie Startzeiten */
export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  const { org, event, from, to } = parsed.data;
  if (to.getTime() - from.getTime() > 42 * 24 * 3600_000) {
    return NextResponse.json({ error: "Zeitraum zu groß (max. 6 Wochen)" }, { status: 400 });
  }
  const et = await loadEventType(org, event);
  if (!et) return NextResponse.json({ error: "Meeting-Typ nicht gefunden" }, { status: 404 });

  const slots = await getSlotsForEventType(et, from, to);
  return NextResponse.json({ slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) });
}
