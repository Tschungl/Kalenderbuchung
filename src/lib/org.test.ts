import { afterAll, describe, expect, it } from "vitest";

// Integrationstest gegen eine echte Datenbank, nur wenn DATABASE_URL gesetzt ist
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Einladungen und Onboarding", async () => {
  const { db } = await import("./db");
  const { bootstrapNewUser, slugify } = await import("./org");
  const suffix = Date.now().toString(36);
  const createdUsers: string[] = [];
  const createdOrgs: string[] = [];

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: { in: createdOrgs } } });
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    await db.$disconnect();
  });

  it("neuer User ohne Einladung bekommt eigene Organisation", async () => {
    const u = await db.user.create({ data: { name: `Test ${suffix}`, email: `a-${suffix}@example.com` } });
    createdUsers.push(u.id);
    const org = await bootstrapNewUser(u);
    expect(org).not.toBeNull();
    createdOrgs.push(org!.id);
    const m = await db.membership.findFirst({ where: { userId: u.id } });
    expect(m?.role).toBe("OWNER");
    expect(await db.eventType.count({ where: { organizationId: org!.id } })).toBe(1);
  });

  it("eingeladener User tritt der Organisation bei statt eine eigene anzulegen", async () => {
    const org = await db.organization.create({ data: { name: "Team", slug: `team-${suffix}` } });
    createdOrgs.push(org.id);
    const email = `b-${suffix}@example.com`;
    await db.invitation.create({
      data: { organizationId: org.id, email, role: "ADMIN", expiresAt: new Date(Date.now() + 86400_000) },
    });
    const u = await db.user.create({ data: { name: "Bea", email } });
    createdUsers.push(u.id);
    expect(await bootstrapNewUser(u)).toBeNull();
    const memberships = await db.membership.findMany({ where: { userId: u.id } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ organizationId: org.id, role: "ADMIN" });
    expect(await db.schedule.count({ where: { userId: u.id } })).toBe(1);
  });

  it("slugify wandelt Umlaute um", () => {
    expect(slugify("Müller & Söhne GmbH")).toBe("mueller-soehne-gmbh");
  });
});
