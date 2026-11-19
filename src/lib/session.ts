import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CURRENT_ORG_COOKIE, getCurrentMembership } from "@/lib/org";

/** Für Dashboard-Seiten: angemeldeter User + aktuelle Organisation, sonst Weiterleitung zum Login. */
export async function requireMember() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  const preferred = (await cookies()).get(CURRENT_ORG_COOKIE)?.value;
  const membership = await getCurrentMembership(user.id, preferred);
  if (!membership) redirect("/onboarding");
  return { user, membership, org: membership.organization };
}

export function canManage(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function requireManager() {
  const ctx = await requireMember();
  if (!canManage(ctx.membership.role)) throw new Error("Keine Berechtigung");
  return ctx;
}
