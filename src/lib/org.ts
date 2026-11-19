import { db } from "@/lib/db";
import { DEFAULT_WEEKLY } from "@/lib/availability";

/** Pfade, die nicht als Organisations-Slug vergeben werden dürfen. */
const RESERVED = new Set(["api", "dashboard", "booking", "login", "invite", "onboarding", "verhandlung", "_next", "favicon.ico", "admin", "embed", "embed.js", "site", "robots.txt"]);

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

/**
 * Wird beim ersten Login aufgerufen.
 * Wer eingeladen wurde, tritt den einladenden Organisationen bei.
 * Alle anderen bekommen eine eigene Organisation mit erstem Meeting-Typ.
 */
export async function bootstrapNewUser(user: { id: string; name?: string | null; email?: string | null }) {
  await db.schedule.create({
    data: { userId: user.id, timeZone: "Europe/Berlin", weekly: DEFAULT_WEEKLY },
  });

  const accepted = user.email ? await acceptPendingInvitations(user.id, user.email) : 0;
  if (accepted > 0) return null;

  const displayName = user.name || user.email?.split("@")[0] || "Mein Team";
  const slug = await uniqueOrgSlug(displayName);
  return db.organization.create({
    data: {
      name: displayName,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
      eventTypes: {
        create: {
          slug: "30min",
          title: "30 Minuten Gespräch",
          description: "Kurzes Kennenlernen per Videokonferenz.",
          durationMin: 30,
          hosts: { create: { userId: user.id } },
        },
      },
    },
  });
}

/** Nimmt alle offenen, gültigen Einladungen für diese E-Mail an. Gibt die Anzahl zurück. */
export async function acceptPendingInvitations(userId: string, email: string) {
  const invitations = await db.invitation.findMany({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  for (const inv of invitations) {
    await acceptInvitation(inv.id, userId);
  }
  return invitations.length;
}

export async function acceptInvitation(invitationId: string, userId: string) {
  const inv = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return db.$transaction(async (tx) => {
    const membership = await tx.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
      create: { userId, organizationId: inv.organizationId, role: inv.role },
      update: {},
    });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return membership;
  });
}

export const CURRENT_ORG_COOKIE = "current_org";

/**
 * Aktuelle Organisation des Users: die im Cookie gewählte, sonst die älteste Mitgliedschaft.
 */
export async function getCurrentMembership(userId: string, preferredOrgId?: string | null) {
  if (preferredOrgId) {
    const m = await db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: preferredOrgId } },
      include: { organization: true },
    });
    if (m) return m;
  }
  return db.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}
