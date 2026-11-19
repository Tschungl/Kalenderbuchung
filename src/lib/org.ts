import { db } from "@/lib/db";
import { DEFAULT_WEEKLY } from "@/lib/availability";

/** Pfade, die nicht als Organisations-Slug vergeben werden dürfen. */
const RESERVED = new Set(["api", "dashboard", "booking", "login", "_next", "favicon.ico", "admin"]);

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

export async function uniqueOrgSlug(base: string): Promise<string> {
  const root = slugify(base);
  let candidate = RESERVED.has(root) ? `${root}-team` : root;
  for (let i = 2; await db.organization.findUnique({ where: { slug: candidate } }); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}

/** Wird beim ersten Login aufgerufen: eigene Organisation, Arbeitszeiten, erster Meeting-Typ. */
export async function bootstrapNewUser(user: { id: string; name?: string | null; email?: string | null }) {
  const displayName = user.name || user.email?.split("@")[0] || "Mein Team";
  const slug = await uniqueOrgSlug(displayName);
  const org = await db.organization.create({
    data: {
      name: displayName,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await db.schedule.create({
    data: { userId: user.id, timeZone: "Europe/Berlin", weekly: DEFAULT_WEEKLY },
  });
  await db.eventType.create({
    data: {
      organizationId: org.id,
      slug: "30min",
      title: "30 Minuten Gespräch",
      description: "Kurzes Kennenlernen per Google Meet.",
      durationMin: 30,
      hosts: { create: { userId: user.id } },
    },
  });
  return org;
}

/** Aktuelle Organisation des Users (Phase 1: die erste Mitgliedschaft). */
export async function getCurrentMembership(userId: string) {
  return db.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}
