import { db } from "@/lib/db";
import { computeSlots, type DateOverride, type HostAvailabilityInput, type Slot, type WeeklyHours } from "@/lib/availability";
import { getGoogleBusy } from "@/lib/google";

export async function loadEventType(orgSlug: string, eventSlug: string) {
  return db.eventType.findFirst({
    where: { slug: eventSlug, active: true, organization: { slug: orgSlug } },
    include: {
      organization: true,
      hosts: { include: { user: { include: { schedule: true } } } },
    },
  });
}

export type LoadedEventType = NonNullable<Awaited<ReturnType<typeof loadEventType>>>;

/** Sammelt Arbeitszeiten + Belegt-Zeiten (Google + eigene Buchungen) und berechnet Slots. */
export async function getSlotsForEventType(et: LoadedEventType, from: Date, to: Date): Promise<Slot[]> {
  const hosts: HostAvailabilityInput[] = await Promise.all(
    et.hosts.map(async (h) => {
      const schedule = h.user.schedule;
      const [googleBusy, bookings] = await Promise.all([
        getGoogleBusy(h.userId, from, to).catch((err) => {
          console.error(`[slots] Google freeBusy für ${h.userId} fehlgeschlagen`, err);
          return null;
        }),
        db.booking.findMany({
          where: {
            status: "CONFIRMED",
            startTime: { lt: to },
            endTime: { gt: from },
            OR: [{ hostId: h.userId }, { eventType: { mode: "COLLECTIVE", hosts: { some: { userId: h.userId } } } }],
          },
          select: { startTime: true, endTime: true },
        }),
      ]);
      // Ist der Kalender nicht erreichbar, lieber keine Slots anbieten als Doppelbuchungen riskieren
      const unreachable = googleBusy === null;
      return {
        id: h.userId,
        required: h.required,
        timeZone: schedule?.timeZone ?? h.user.timeZone,
        weekly: unreachable ? {} : ((schedule?.weekly ?? {}) as WeeklyHours),
        overrides: (schedule?.overrides ?? []) as DateOverride[],
        busy: [...(googleBusy ?? []), ...bookings.map((b) => ({ start: b.startTime, end: b.endTime }))],
      };
    }),
  );

  return computeSlots({
    hosts,
    mode: et.mode,
    durationMin: et.durationMin,
    bufferBeforeMin: et.bufferBeforeMin,
    bufferAfterMin: et.bufferAfterMin,
    minNoticeMin: et.minNoticeMin,
    maxDaysAhead: et.maxDaysAhead,
    stepMin: et.slotStepMin,
    rangeStart: from,
    rangeEnd: to,
  });
}
