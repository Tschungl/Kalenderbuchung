"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/booking";
import { sendMail } from "@/lib/mail";
import { CURRENT_ORG_COOKIE, slugify, uniqueOrgSlug } from "@/lib/org";
import { requireManager, requireMember } from "@/lib/session";
import { auth } from "@/auth";

const INVITE_DAYS = 7;
const RoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export async function inviteMember(formData: FormData) {
  const { org, user, membership } = await requireManager();
  const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));
  const role = RoleSchema.parse(formData.get("role") ?? "MEMBER");
  if (role === "OWNER" && membership.role !== "OWNER") throw new Error("Nur Inhaber können Inhaber einladen.");

  const alreadyMember = await db.membership.findFirst({ where: { organizationId: org.id, user: { email } } });
  if (alreadyMember) throw new Error(`${email} ist bereits Mitglied.`);

  // Offene Einladung an dieselbe Adresse ersetzen
  await db.invitation.deleteMany({ where: { organizationId: org.id, email, acceptedAt: null } });
  const invitation = await db.invitation.create({
    data: {
      organizationId: org.id,
      email,
      role,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 3600_000),
    },
  });
  await sendMail(
    email,
    `Einladung zu ${org.name}`,
    [
      `Hallo,`,
      ``,
      `${user.name ?? user.email} lädt dich ein, dem Team "${org.name}" beizutreten.`,
      `Nach dem Beitritt kannst du deinen Kalender (Google oder Outlook) verbinden und Termine annehmen.`,
      ``,
      `Einladung annehmen: ${appUrl()}/invite/${invitation.token}`,
      ``,
      `Der Link ist ${INVITE_DAYS} Tage gültig.`,
    ].join("\n"),
  );
  revalidatePath("/dashboard/team");
}

export async function revokeInvitation(invitationId: string) {
  const { org } = await requireManager();
  await db.invitation.deleteMany({ where: { id: invitationId, organizationId: org.id, acceptedAt: null } });
  revalidatePath("/dashboard/team");
}

async function ownerCount(orgId: string) {
  return db.membership.count({ where: { organizationId: orgId, role: "OWNER" } });
}

export async function changeRole(membershipId: string, formData: FormData) {
  const { org, membership: me } = await requireManager();
  const role = RoleSchema.parse(formData.get("role"));
  const target = await db.membership.findFirst({ where: { id: membershipId, organizationId: org.id } });
  if (!target) throw new Error("Nicht gefunden");
  if ((target.role === "OWNER" || role === "OWNER") && me.role !== "OWNER") {
    throw new Error("Nur Inhaber können Inhaber-Rollen ändern.");
  }
  if (target.role === "OWNER" && role !== "OWNER" && (await ownerCount(org.id)) <= 1) {
    throw new Error("Die Organisation braucht mindestens einen Inhaber.");
  }
  await db.membership.update({ where: { id: target.id }, data: { role } });
  revalidatePath("/dashboard/team");
}

export async function removeMember(membershipId: string) {
  const { org, membership: me } = await requireManager();
  const target = await db.membership.findFirst({ where: { id: membershipId, organizationId: org.id } });
  if (!target) throw new Error("Nicht gefunden");
  if (target.role === "OWNER" && me.role !== "OWNER") throw new Error("Nur Inhaber können Inhaber entfernen.");
  if (target.role === "OWNER" && (await ownerCount(org.id)) <= 1) {
    throw new Error("Der letzte Inhaber kann nicht entfernt werden.");
  }
  await db.$transaction([
    // Aus allen Meeting-Typen dieser Organisation austragen
    db.eventTypeHost.deleteMany({ where: { userId: target.userId, eventType: { organizationId: org.id } } }),
    db.membership.delete({ where: { id: target.id } }),
  ]);
  revalidatePath("/dashboard/team");
  if (target.userId === me.userId) redirect("/dashboard");
}

export async function switchOrganization(orgId: string) {
  const { user } = await requireMember();
  const m = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!m) throw new Error("Kein Mitglied dieser Organisation");
  (await cookies()).set(CURRENT_ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  redirect("/dashboard");
}

const OrgSettings = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(2).max(40),
});

export async function updateOrganization(formData: FormData) {
  const { org } = await requireManager();
  const data = OrgSettings.parse(Object.fromEntries(formData));
  let slug = slugify(data.slug);
  if (slug !== org.slug) slug = await uniqueOrgSlug(slug);
  await db.organization.update({
    where: { id: org.id },
    data: { name: data.name, slug },
  });
  revalidatePath("/dashboard", "layout");
}

/** Eigene neue Organisation anlegen (z.B. zweite Firma oder nach Austritt). */
export async function createOrganization(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
  const org = await db.organization.create({
    data: {
      name,
      slug: await uniqueOrgSlug(name),
      memberships: { create: { userId: session.user.id, role: "OWNER" } },
    },
  });
  (await cookies()).set(CURRENT_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
  redirect("/dashboard");
}
