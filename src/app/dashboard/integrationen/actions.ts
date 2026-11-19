"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { generateApiKey } from "@/lib/integrations/apiKeys";
import { WEBHOOK_EVENTS, deliverWebhook, isAllowedWebhookUrl, newWebhookSecret } from "@/lib/integrations/webhooks";

const PATH = "/dashboard/integrationen";

export async function createWebhook(formData: FormData) {
  const { org } = await requireManager();
  const url = z.string().trim().url().max(500).parse(formData.get("url"));
  if (!isAllowedWebhookUrl(url)) throw new Error("Bitte eine öffentliche https-Adresse angeben.");
  const events = formData.getAll("events").map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (events.length === 0) throw new Error("Mindestens ein Ereignis auswählen.");
  if ((await db.webhook.count({ where: { organizationId: org.id } })) >= 10) throw new Error("Maximal 10 Webhooks.");
  await db.webhook.create({ data: { organizationId: org.id, url, events, secret: newWebhookSecret() } });
  revalidatePath(PATH);
}

export async function toggleWebhook(id: string) {
  const { org } = await requireManager();
  const hook = await db.webhook.findFirst({ where: { id, organizationId: org.id } });
  if (hook) await db.webhook.update({ where: { id }, data: { active: !hook.active } });
  revalidatePath(PATH);
}

export async function deleteWebhook(id: string) {
  const { org } = await requireManager();
  await db.webhook.deleteMany({ where: { id, organizationId: org.id } });
  revalidatePath(PATH);
}

/** Schickt ein Testereignis an genau diesen Webhook. */
export async function testWebhook(id: string) {
  const { org } = await requireManager();
  const hook = await db.webhook.findFirst({ where: { id, organizationId: org.id } });
  if (hook) await deliverWebhook(hook, "test", { message: "Testaufruf aus dem Dashboard", organization: org.slug });
  revalidatePath(PATH);
}

export type NewKeyState = { key?: string; error?: string };

export async function createApiKey(_prev: NewKeyState, formData: FormData): Promise<NewKeyState> {
  const { org, user } = await requireManager();
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: "Bitte einen Namen angeben." };
  const { key, prefix, hash } = generateApiKey();
  await db.apiKey.create({ data: { organizationId: org.id, name: name.data, prefix, hash, createdById: user.id } });
  revalidatePath(PATH);
  return { key };
}

export async function deleteApiKey(id: string) {
  const { org } = await requireManager();
  await db.apiKey.deleteMany({ where: { id, organizationId: org.id } });
  revalidatePath(PATH);
}

export async function saveReminders(formData: FormData) {
  const { org } = await requireManager();
  const offsets = formData
    .getAll("reminder")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 7 * 1440);
  await db.organization.update({
    where: { id: org.id },
    data: { reminderOffsetsMin: [...new Set(offsets)].sort((a, b) => b - a) },
  });
  revalidatePath(PATH);
}
