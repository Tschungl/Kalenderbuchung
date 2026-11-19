import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { appUrl } from "@/lib/booking";
import { connectZoom } from "@/lib/zoom";

/** GET /api/integrations/zoom/callback  ->  Zoom leitet nach der Anmeldung hierher zurück */
export async function GET(req: NextRequest) {
  const back = (status: string) => {
    const res = NextResponse.redirect(`${appUrl()}/dashboard/integrationen?zoom=${status}`);
    res.cookies.delete({ name: "zoom_oauth_state", path: "/api/integrations/zoom" });
    return res;
  };
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl()}/login`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("zoom_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) return back("fehler");
  try {
    await connectZoom(session.user.id, code, appUrl());
    return back("verbunden");
  } catch (err) {
    console.error("[zoom] Verbinden fehlgeschlagen", err);
    return back("fehler");
  }
}
