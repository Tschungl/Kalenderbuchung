"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { cancelBooking } from "@/lib/booking";
import { slugify } from "@/lib/org";
import { canManage, requireManager, requireMember } from "@/lib/session";
import type { WeeklyHours } from "@/lib/availability";
import { NegotiationRulesSchema } from "@/lib/negotiation/rules";

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const EventTypeForm = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(60).optional(),
  description: z.string().max(5000).optional(),
  durationMin: int(5, 600),
  bufferBeforeMin: int(0, 240),
  bufferAfterMin: int(0, 240),
  minNoticeMin: int(0, 60 * 24 * 30),
  maxDaysAhead: int(1, 365),
  slotStepMin: int(5, 120),
  mode: z.enum(["SINGLE", "COLLECTIVE", "ROUND_ROBIN"]),
  locationType: z.enum(["GOOGLE_MEET", "PHONE", "IN_PERSON", "CUSTOM_LINK"]),
  locationValue: z.string().max(500).optional(),
  maxGuests: int(0, 20),
  active: z.coerce.boolean().default(false),
});

function parseEventTypeForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const data = EventTypeForm.parse({ ...raw, active: raw.active === "on" });
  const hostIds = formData.getAll("hostIds").map(String);
  const hostSettings = Object.fromEntries(
    hostIds.map((id) => [
      id,
      {
        required: formData.get(`optional_${id}`) !== "on",
        weight: Math.min(10, Math.max(1, Number(formData.get(`weight_${id}`)) || 1)),
      },
    ]),
  );
  const negotiation = NegotiationRulesSchema.parse({
    enabled: formData.get("neg_enabled") === "on",
    extendedStart: formData.get("neg_extendedStart") || undefined,
    extendedEnd: formData.get("neg_extendedEnd") || undefined,
    allowWeekends: formData.get("neg_allowWeekends") === "on",
    minNoticeMin: Number(formData.get("neg_minNoticeMin") ?? 120),
    autoBookExtended: formData.get("neg_autoBook") === "on",
    maxTurns: Number(formData.get("neg_maxTurns") ?? 12),
    instructions: String(formData.get("neg_instructions") ?? "").slice(0, 2000),
  });
  return { data: { ...data, negotiation, slug: slugify(data.slug || data.title) }, hostIds, hostSettings };
}

async function validHostIds(orgId: string, hostIds: string[], fallback: string) {
  const members = await db.membership.findMany({ where: { organizationId: orgId, userId: { in: hostIds } } });
  const ids = members.map((m) => m.userId);
  return ids.length > 0 ? ids : [fallback];
}

export async function createEventType(formData: FormData) {
  const { org, user } = await requireManager();
  const { data, hostIds, hostSettings } = parseEventTypeForm(formData);
  const hosts = await validHostIds(org.id, hostIds, user.id);
  if (await db.eventType.findFirst({ where: { organizationId: org.id, slug: data.slug } })) {
    throw new Error(`Das URL-Kürzel "${data.slug}" ist schon vergeben.`);
  }
  await db.eventType.create({
    data: {
      ...data,
      organizationId: org.id,
      hosts: { create: hosts.map((userId) => ({ userId, ...(hostSettings[userId] ?? {}) })) },
    },
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateEventType(id: string, formData: FormData) {
  const { org, user } = await requireManager();
  const existing = await db.eventType.findFirst({ where: { id, organizationId: org.id } });
  if (!existing) throw new Error("Nicht gefunden");
  const { data, hostIds, hostSettings } = parseEventTypeForm(formData);
  const hosts = await validHostIds(org.id, hostIds, user.id);
  await db.$transaction([
    db.eventType.update({ where: { id }, data }),
    db.eventTypeHost.deleteMany({ where: { eventTypeId: id, userId: { notIn: hosts } } }),
    ...hosts.map((userId) =>
      db.eventTypeHost.upsert({
        where: { eventTypeId_userId: { eventTypeId: id, userId } },
        create: { eventTypeId: id, userId, ...(hostSettings[userId] ?? {}) },
        update: { ...(hostSettings[userId] ?? {}) },
      }),
    ),
  ]);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteEventType(id: string) {
  const { org } = await requireManager();
  await db.eventType.deleteMany({ where: { id, organizationId: org.id } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

const DAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function saveSchedule(formData: FormData) {
  const { user } = await requireMember();
  const timeZone = z.string().min(1).parse(formData.get("timeZone"));
  const weekly: WeeklyHours = {};
  for (const d of DAYS) {
    if (formData.get(`on_${d}`) !== "on") continue;
    const start = time.parse(formData.get(`start_${d}`));
    const end = time.parse(formData.get(`end_${d}`));
    if (end > start) weekly[d] = [{ start, end }];
  }
  await db.$transaction([
    db.schedule.upsert({
      where: { userId: user.id },
      create: { userId: user.id, timeZone, weekly },
      update: { timeZone, weekly },
    }),
    db.user.update({ where: { id: user.id }, data: { timeZone } }),
  ]);
  revalidatePath("/dashboard/availability");
}

export async function cancelBookingFromDashboard(bookingId: string) {
  const { org, user, membership } = await requireMember();
  const booking = await db.booking.findFirst({ where: { id: bookingId, organizationId: org.id } });
  if (!booking) throw new Error("Nicht gefunden");
  if (booking.hostId !== user.id && !canManage(membership.role)) throw new Error("Keine Berechtigung");
  await cancelBooking(booking.manageToken);
  revalidatePath("/dashboard/bookings");
}
