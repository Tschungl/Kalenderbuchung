import { NextResponse } from "next/server";
import { BookingError } from "@/lib/booking";
import { authenticateApiKey } from "./apiKeys";

type Org = NonNullable<Awaited<ReturnType<typeof authenticateApiKey>>>;

/** Hülle für /api/v1-Routen: prüft den API-Schlüssel und fängt Fehler einheitlich ab. */
export function withApiKey<C>(handler: (req: Request, org: Org, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    const org = await authenticateApiKey(req);
    if (!org) {
      return NextResponse.json(
        { error: "Ungültiger oder fehlender API-Schlüssel (Authorization: Bearer kb_...)" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
      );
    }
    try {
      return await handler(req, org, ctx);
    } catch (err) {
      if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error("[api/v1]", err);
      return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
    }
  };
}
