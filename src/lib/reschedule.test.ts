import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;
vi.mock("@/lib/google", () => ({
  getGoogleBusy: vi.fn(async () => []),
  createGoogleEvent: vi.fn(async () => ({ eventId: `evt_${Math.random()}`, meetUrl: "https://meet.example/x" })),
  cancelGoogleEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: vi.fn(async () => undefined) }));

describe.skipIf(!hasDb)("Termin verschieben", async () => {
  const { db } = await import("@/lib/db");
  const { createBooking, rescheduleBooking, BookingError } = await import("./booking");
  const { loadEventTypeById } = await import("./slots");
  const suffix = Date.now().toString(36);
  let orgId = "";
  let userId = "";
  let etId = "";

  // Zwei freie Werktags-Zeiten in ~2 Wochen, 10 und 14 Uhr Berlin
  const day = new Date(Date.now() + 14 * 86400_000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const at = (h: number) => new Date(`${day.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00:00Z`);

  beforeAll(async () => {
    const all = { start: "06:00", end: "20:00" };
    const user = await db.user.create({
      data: {
        name: "Gastgeber",
        email: `res-${suffix}@example.com`,
        schedule: { create: { timeZone: "UTC", weekly: { "1": [all], "2": [all], "3": [all], "4": [all], "5": [all] } } },
      },
    });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "Verschieben", slug: `res-${suffix}` } });
    orgId = org.id;
    const et = await db.eventType.create({
      data: { organizationId: org.id, slug: "x", title: "Termin", minNoticeMin: 0, maxGuests: 2, hosts: { create: { userId } } },
    });
    etId = et.id;
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: orgId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("legt die neue Buchung an und sagt die alte ab", async () => {
    const et = (await loadEventTypeById(etId))!;
    const old = await createBooking(et, { start: at(10), name: "Kundin", email: "k@example.com", timeZone: "UTC", guests: ["g@example.com"] });
    const neu = await rescheduleBooking(old.manageToken, at(14));
    expect(neu.startTime.toISOString()).toBe(at(14).toISOString());
    expect(neu.rescheduledFromId).toBe(old.id);
    const oldNow = await db.booking.findUnique({ where: { id: old.id } });
    expect(oldNow?.status).toBe("CANCELLED");
    const attendees = await db.attendee.findMany({ where: { bookingId: neu.id } });
    expect(attendees.map((a) => [a.email, a.isGuest]).sort()).toEqual([
      ["g@example.com", true],
      ["k@example.com", false],
    ]);
    // Ein abgesagter Termin kann nicht noch einmal verschoben werden
    await expect(rescheduleBooking(old.manageToken, at(15))).rejects.toBeInstanceOf(BookingError);
  });
});
