import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appUrl } from "@/lib/booking";
import { zoomAuthorizeUrl, zoomEnabled } from "@/lib/zoom";

/** GET /api/integrations/zoom/connect  ->  weiter zur Zoom-Anmeldung */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl()}/login`);
  if (!zoomEnabled()) return NextResponse.json({ error: "Zoom ist nicht eingerichtet" }, { status: 404 });
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(zoomAuthorizeUrl(appUrl(), state));
  res.cookies.set("zoom_oauth_state", state, {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/integrations/zoom",
  });
  return res;
}
