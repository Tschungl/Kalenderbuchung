import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/integrations/api";

/** GET /api/v1/event-types  ->  Meeting-Typen der Organisation */
export const GET = withApiKey(async (_req, org) => {
  const types = await db.eventType.findMany({
    where: { organizationId: org.id },
    include: { hosts: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    data: types.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      durationMin: t.durationMin,
      mode: t.mode,
      locationType: t.locationType,
      active: t.active,
      bookingUrl: `/${org.slug}/${t.slug}`,
      hosts: t.hosts.map((h) => ({ ...h.user, required: h.required, weight: h.weight })),
    })),
  });
});
