import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { NegotiationError, runNegotiationTurn } from "@/lib/negotiation/agent";

const Body = z.object({ message: z.string().trim().min(1).max(1000) });

/** POST /api/negotiations/:token/messages  ->  weitere Kundennachricht */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nachricht fehlt oder ist zu lang" }, { status: 400 });
  const neg = await db.negotiation.findUnique({ where: { token } });
  if (!neg) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  try {
    return NextResponse.json(await runNegotiationTurn(neg.id, parsed.data.message));
  } catch (err) {
    if (err instanceof NegotiationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[negotiation]", err);
    return NextResponse.json({ error: "Der Assistent ist gerade nicht erreichbar." }, { status: 502 });
  }
}
