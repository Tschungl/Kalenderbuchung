"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { z } from "zod";
import { BUTTON_STYLES, FONT_STYLES, PAGE_THEMES } from "@/lib/branding";
import { appHost, checkDomainTxt, normalizeDomain } from "@/lib/domains";

const BrandingSchema = z.object({
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.union([z.literal(""), z.string().url().max(500).refine((u) => /^https?:\/\//.test(u))]).optional(),
  welcomeTitle: z.string().trim().max(120).optional(),
  welcomeText: z.string().trim().max(2000).optional(),
  confirmationText: z.string().trim().max(1000).optional(),
  fontStyle: z.enum(Object.keys(FONT_STYLES) as [keyof typeof FONT_STYLES]),
  buttonStyle: z.enum(Object.keys(BUTTON_STYLES) as [keyof typeof BUTTON_STYLES]),
  pageTheme: z.enum(Object.keys(PAGE_THEMES) as [keyof typeof PAGE_THEMES]),
  salutation: z.enum(["SIE", "DU"]),
});

export async function updateBranding(formData: FormData) {
  const { org } = await requireManager();
  const data = BrandingSchema.parse(Object.fromEntries(formData));
  await db.organization.update({
    where: { id: org.id },
    data: {
      brandColor: data.brandColor,
      logoUrl: data.logoUrl || null,
      welcomeTitle: data.welcomeTitle || null,
      welcomeText: data.welcomeText || null,
      confirmationText: data.confirmationText || null,
      fontStyle: data.fontStyle,
      buttonStyle: data.buttonStyle,
      pageTheme: data.pageTheme,
      salutation: data.salutation,
    },
  });
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${org.slug}`, "layout");
}

export async function setCustomDomain(formData: FormData) {
  const { org } = await requireManager();
  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) throw new Error("Bitte eine gültige Domain angeben, z.B. termine.firma.de");
  if (domain === appHost().replace(/:\d+$/, "")) throw new Error("Das ist die Adresse der App selbst.");
  const taken = await db.organization.findFirst({ where: { customDomain: domain, id: { not: org.id } } });
  if (taken) throw new Error("Diese Domain wird bereits von einer anderen Organisation benutzt.");
  await db.organization.update({
    where: { id: org.id },
    data: { customDomain: domain, domainVerifiedAt: null },
  });
  revalidatePath("/dashboard/settings");
}

export async function verifyCustomDomain() {
  const { org } = await requireManager();
  if (!org.customDomain) return;
  const ok = await checkDomainTxt(org.customDomain, org.domainToken);
  await db.organization.update({ where: { id: org.id }, data: { domainVerifiedAt: ok ? new Date() : null } });
  revalidatePath("/dashboard/settings");
  if (!ok) throw new Error("Der TXT-Eintrag wurde noch nicht gefunden. DNS-Änderungen brauchen manchmal bis zu einer Stunde.");
}

export async function removeCustomDomain() {
  const { org } = await requireManager();
  await db.organization.update({ where: { id: org.id }, data: { customDomain: null, domainVerifiedAt: null } });
  revalidatePath("/dashboard/settings");
}
