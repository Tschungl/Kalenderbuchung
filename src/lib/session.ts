import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/org";

/** Für Dashboard-Seiten: angemeldeter User + aktuelle Organisation, sonst Weiterleitung zum Login. */
export async function requireMember() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  const membership = await getCurrentMembership(user.id);
  if (!membership) throw new Error("Keine Organisation gefunden");
  return { user, membership, org: membership.organization };
}

export function canManage(role: string) {
  return role === "OWNER" || role === "ADMIN";
}
