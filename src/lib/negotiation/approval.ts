import { db } from "@/lib/db";
import { appUrl, BookingError, createBooking } from "@/lib/booking";
import { formatDateTime, sendMail } from "@/lib/mail";
import { loadEventTypeById } from "@/lib/slots";
import { parseRules } from "./rules";
import type { TranscriptEntry } from "./agent";
import type { Prisma } from "@prisma/client";

async function addSystemNote(negotiationId: string, transcript: unknown, text: string) {
  const entries = (transcript as TranscriptEntry[]) ?? [];
  entries.push({ role: "system", text, at: new Date().toISOString() });
  await db.negotiation.update({
    where: { id: negotiationId },
    data: { transcript: entries as unknown as Prisma.InputJsonValue },
  });
}

/** Gastgeber gibt eine Ausnahmezeit frei oder lehnt sie ab. */
export async function decideApproval(approvalToken: string, approve: boolean) {
  const neg = await db.negotiation.findUnique({ where: { approvalToken } });
  if (!neg || neg.status !== "AWAITING_APPROVAL" || !neg.pendingStart) {
    return { ok: false, message: "Diese Anfrage ist nicht mehr offen." };
  }
  const et = await loadEventTypeById(neg.eventTypeId);
  if (!et) return { ok: false, message: "Meeting-Typ nicht gefunden." };
  const when = formatDateTime(neg.pendingStart, neg.timeZone);
  const link = `${appUrl()}/verhandlung/${neg.token}`;

  if (approve) {
    try {
      // Für die Freigabe gelten die erweiterten Regeln inkl. Wochenende
      const rules = { ...parseRules(et.negotiation), enabled: true };
      const booking = await createBooking(
        et,
        {
          start: neg.pendingStart,
          name: neg.customerName,
          email: neg.customerEmail,
          timeZone: neg.timeZone,
          guests: [],
          notes: `Per KI-Terminverhandlung vereinbart, vom Gastgeber freigegeben.${neg.pendingReason ? ` Begründung: ${neg.pendingReason}` : ""}`,
        },
        { rules },
      );
      await db.negotiation.update({
        where: { id: neg.id },
        data: { status: "BOOKED", bookingId: booking.id, approvalToken: null },
      });
      await addSystemNote(neg.id, neg.transcript, `Der Gastgeber hat ${when} freigegeben. Der Termin ist gebucht.`);
      return { ok: true, message: `Freigegeben. Der Termin am ${when} ist gebucht und ${neg.customerName} wurde eingeladen.` };
    } catch (err) {
      if (!(err instanceof BookingError)) throw err;
      // Zeit inzwischen belegt: wie Ablehnung behandeln
      approve = false;
    }
  }

  await db.negotiation.update({
    where: { id: neg.id },
    data: { status: "DECLINED", approvalToken: null, pendingStart: null },
  });
  await addSystemNote(neg.id, neg.transcript, `Die Zeit ${when} ist leider nicht möglich.`);
  await sendMail(
    neg.customerEmail,
    `Termin am ${when} leider nicht möglich`,
    [
      `Hallo ${neg.customerName},`,
      ``,
      `die angefragte Zeit für "${et.title}" (${when}) ist leider nicht möglich.`,
      `Hier kannst du direkt eine andere Zeit finden: ${link}`,
    ].join("\n"),
  ).catch((e) => console.error("[negotiation] Absage-Mail fehlgeschlagen", e));
  return { ok: true, message: "Abgelehnt. Der Kunde wurde informiert und kann eine andere Zeit wählen." };
}
