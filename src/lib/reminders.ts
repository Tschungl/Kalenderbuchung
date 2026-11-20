import { db } from "@/lib/db";
import { t } from "@/lib/salutation";
import { appUrl } from "@/lib/booking";
import { formatDateTime, sendMail } from "@/lib/mail";

/** Wie weit zurück eine verpasste Erinnerung noch nachgeholt wird (z.B. nach Neustart). */
const GRACE_MIN = 30;

export function describeOffset(min: number) {
  if (min % 1440 === 0) return min === 1440 ? "morgen" : `in ${min / 1440} Tagen`;
  if (min % 60 === 0) return min === 60 ? "in einer Stunde" : `in ${min / 60} Stunden`;
  return `in ${min} Minuten`;
}

/**
 * Verschickt alle fälligen Erinnerungen. Fällig ist eine Erinnerung, wenn
 * start - offset <= now < start - offset + GRACE und sie noch nicht verschickt wurde.
 * Idempotent dank ReminderLog (bookingId, offsetMin) unique.
 */
export async function sendDueReminders(now = new Date()) {
  const orgs = await db.organization.findMany({
    where: { reminderOffsetsMin: { isEmpty: false } },
    select: { id: true, reminderOffsetsMin: true },
  });
  let sent = 0;
  for (const org of orgs) {
    for (const offset of org.reminderOffsetsMin) {
      const windowStart = new Date(now.getTime() + (offset - GRACE_MIN) * 60_000);
      const windowEnd = new Date(now.getTime() + offset * 60_000);
      const bookings = await db.booking.findMany({
        where: {
          organizationId: org.id,
          status: "CONFIRMED",
          startTime: { gt: windowStart, lte: windowEnd },
          // Nicht erinnern, wenn erst kurz vorher gebucht wurde
          createdAt: { lt: new Date(now.getTime() - 5 * 60_000) },
          reminders: { none: { offsetMin: offset } },
        },
        include: { attendees: true, eventType: true, host: true, organization: true },
      });
      for (const b of bookings) {
        // Eintrag zuerst anlegen: schlägt er fehl (parallel schon verschickt), keine Mail
        const claimed = await db.reminderLog
          .create({ data: { bookingId: b.id, offsetMin: offset } })
          .then(() => true)
          .catch(() => false);
        if (!claimed) continue;
        const recipients = [
          ...b.attendees.map((a) => ({ email: a.email, name: a.name, tz: a.timeZone, guest: true })),
          ...(b.host.email ? [{ email: b.host.email, name: b.host.name ?? "", tz: b.host.timeZone, guest: false }] : []),
        ];
        for (const r of recipients) {
          const when = formatDateTime(b.startTime, r.tz);
          // Gastgeber werden wie im Dashboard geduzt, Kunden in der Anrede der Organisation
          const tx = t(r.guest ? b.organization.salutation : "DU");
          await sendMail(
            r.email,
            `Erinnerung: ${b.eventType.title} ${describeOffset(offset)}`,
            [
              tx.hello(r.name || undefined),
              ``,
              tx.reminder(b.eventType.title, b.organization.name),
              `Wann: ${when}`,
              b.meetingUrl ? `Video: ${b.meetingUrl}` : b.eventType.locationValue ? `Ort: ${b.eventType.locationValue}` : "",
              ``,
              r.guest ? `Absagen: ${appUrl()}/booking/${b.manageToken}` : `Übersicht: ${appUrl()}/dashboard/bookings`,
            ]
              .filter((l) => l !== undefined)
              .join("\n"),
          ).catch((err) => console.error("[reminder] Mail fehlgeschlagen", err));
        }
        sent++;
      }
    }
  }
  return sent;
}

let started = false;

/** Startet den minütlichen Erinnerungs-Takt im Server-Prozess (siehe src/instrumentation.ts). */
export function startReminderLoop() {
  if (started || process.env.DISABLE_REMINDER_LOOP === "1") return;
  started = true;
  const tick = () =>
    sendDueReminders().catch((err) => console.error("[reminder] Durchlauf fehlgeschlagen", err));
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000).unref?.();
}
