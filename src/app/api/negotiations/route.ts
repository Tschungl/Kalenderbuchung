import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { negotiationAvailable, NegotiationError, runNegotiationTurn } from "@/lib/negotiation/agent";
import { parseRules } from "@/lib/negotiation/rules";
import { intakeActive, parseIntake } from "@/lib/negotiation/intake";
import { getSlotsForEventType } from "@/lib/slots";
import { loadEventType } from "@/lib/slots";

const Body = z.object({
  org: z.string().min(1),
  event: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  timeZone: z.string().min(1).max(64),
  /** Erste Nachricht; fehlt sie, beginnt der Assistent mit den Vorabfragen */
  message: z.string().trim().min(1).max(1000).optional(),
  /** Vorab gewählte Zeit (bei Vorabfragen) */
  start: z.coerce.date().optional(),
});

/** POST /api/negotiations  ->  neue Verhandlung starten (erste Kundennachricht) */
export async function POST(req: Request) {
  if (!negotiationAvailable()) return NextResponse.json({ error: "Verhandlung ist nicht eingerichtet." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bitte Eingaben prüfen" }, { status: 400 });
  const { org, event, name, email, timeZone, message, start } = parsed.data;

  const et = await loadEventType(org, event);
  const intake = intakeActive(parseIntake(et?.intake));
  if (!et || (!parseRules(et.negotiation).enabled && !intake)) {
    return NextResponse.json({ error: "Für diesen Termin ist keine Verhandlung aktiviert." }, { status: 404 });
  }
  if (!message && !intake) return NextResponse.json({ error: "Bitte eine Nachricht eingeben" }, { status: 400 });

  // Vorab gewählte Zeit prüfen; nur eine freie reguläre Zeit wird übernommen
  let preferred: { start: string; end: string; kind: "regular" } | null = null;
  if (start && intake) {
    const end = new Date(start.getTime() + et.durationMin * 60_000);
    const slots = await getSlotsForEventType(et, start, end);
    const slot = slots.find((s) => s.start.getTime() === start.getTime());
    if (!slot) return NextResponse.json({ error: "Dieser Termin ist leider nicht mehr frei." }, { status: 409 });
    preferred = { start: slot.start.toISOString(), end: slot.end.toISOString(), kind: "regular" };
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
      preferredStart: preferred ? new Date(preferred.start) : null,
      knownSlots: preferred ? [preferred] : [],
    },
  });
  try {
    const result = message
      ? await runNegotiationTurn(neg.id, message)
      : await runNegotiationTurn(neg.id, "[Der Kunde hat Name und E-Mail angegeben und möchte buchen. Begrüße ihn kurz und beginne mit den Vorabfragen.]", { hidden: true });
    return NextResponse.json({ token: neg.token, ...result });
  } catch (err) {
    if (err instanceof NegotiationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[negotiation]", err);
    return NextResponse.json({ error: "Der Assistent ist gerade nicht erreichbar.", token: neg.token }, { status: 502 });
  }
}
