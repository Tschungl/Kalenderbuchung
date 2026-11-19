import { NextResponse } from "next/server";
import { z } from "zod";
import { getSlotsForEventType, loadEventTypeById } from "@/lib/slots";
import { withApiKey } from "@/lib/integrations/api";

const Query = z.object({ eventTypeId: z.string().min(1), from: z.coerce.date(), to: z.coerce.date() });

/** GET /api/v1/slots?eventTypeId=...&from=ISO&to=ISO */
export const GET = withApiKey(async (req, org) => {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Parameter", issues: parsed.error.issues }, { status: 400 });
  const { eventTypeId, from, to } = parsed.data;
  if (to.getTime() - from.getTime() > 42 * 24 * 3600_000) {
    return NextResponse.json({ error: "Zeitraum zu groß (max. 6 Wochen)" }, { status: 400 });
  }
  const et = await loadEventTypeById(eventTypeId);
  if (!et || et.organizationId !== org.id || !et.active) {
    return NextResponse.json({ error: "Meeting-Typ nicht gefunden" }, { status: 404 });
  }
  const slots = await getSlotsForEventType(et, from, to);
  return NextResponse.json({ data: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) });
});
