import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { negotiationAvailable, NegotiationError, runNegotiationTurn } from "@/lib/negotiation/agent";
import { parseRules } from "@/lib/negotiation/rules";
import { loadEventType } from "@/lib/slots";

const Body = z.object({
  org: z.string().min(1),
  event: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  timeZone: z.string().min(1).max(64),
  message: z.string().trim().min(1).max(1000),
});

/** POST /api/negotiations  ->  neue Verhandlung starten (erste Kundennachricht) */
export async function POST(req: Request) {
  if (!negotiationAvailable()) return NextResponse.json({ error: "Verhandlung ist nicht eingerichtet." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte Eingaben prüfen" }, { status: 400 });
  const { org, event, name, email, timeZone, message } = parsed.data;

  const et = await loadEventType(org, event);
  if (!et || !parseRules(et.negotiation).enabled) {
    return NextResponse.json({ error: "Für diesen Termin ist keine Verhandlung aktiviert." }, { status: 404 });
  }
  // Einfacher Missbrauchsschutz: höchstens 5 offene Verhandlungen pro E-Mail und Tag
  const recent = await db.negotiation.count({
    where: { customerEmail: email.toLowerCase(), createdAt: { gt: new Date(Date.now() - 86400_000) } },
  });
  if (recent >= 5) return NextResponse.json({ error: "Zu viele Anfragen. Bitte versuch es morgen wieder." }, { status: 429 });

  const neg = await db.negotiation.create({
    data: {
      organizationId: et.organizationId,
      eventTypeId: et.id,
      customerName: name,
      customerEmail: email.toLowerCase(),
      timeZone,
    },
  });
  try {
    const result = await runNegotiationTurn(neg.id, message);
    return NextResponse.json({ token: neg.token, ...result });
  } catch (err) {
    if (err instanceof NegotiationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[negotiation]", err);
    return NextResponse.json({ error: "Der Assistent ist gerade nicht erreichbar.", token: neg.token }, { status: 502 });
  }
}
