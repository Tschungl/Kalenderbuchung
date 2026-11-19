"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { z } from "zod";
import { BUTTON_STYLES, FONT_STYLES, PAGE_THEMES } from "@/lib/branding";

const BrandingSchema = z.object({
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.union([z.literal(""), z.string().url().max(500).refine((u) => /^https?:\/\//.test(u))]).optional(),
  welcomeTitle: z.string().trim().max(120).optional(),
  welcomeText: z.string().trim().max(2000).optional(),
  confirmationText: z.string().trim().max(1000).optional(),
  fontStyle: z.enum(Object.keys(FONT_STYLES) as [keyof typeof FONT_STYLES]),
  buttonStyle: z.enum(Object.keys(BUTTON_STYLES) as [keyof typeof BUTTON_STYLES]),
  pageTheme: z.enum(Object.keys(PAGE_THEMES) as [keyof typeof PAGE_THEMES]),
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
    },
  });
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${org.slug}`, "layout");
}
