import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { normalizeGuests } from "./booking";

const hasDb = !!process.env.DATABASE_URL;
const google = vi.hoisted(() => ({
  getGoogleBusy: vi.fn(async () => []),
  createGoogleEvent: vi.fn(async (_input: unknown) => ({ eventId: `evt_${Math.random()}`, meetUrl: "https://meet.example/x" })),
  cancelGoogleEvent: vi.fn(async () => undefined),
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn(async (_to: string, _subject: string, _text: string) => undefined) }));
vi.mock("@/lib/google", () => google);
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: mail.sendMail }));

describe("normalizeGuests", () => {
  it("entfernt Dubletten, Leereinträge und den Buchenden selbst", () => {
    expect(
      normalizeGuests(["Ben@Firma.de", { email: "ben@firma.de", name: "Ben" }, { email: " cara@firma.de ", name: " Cara " }, "kunde@firma.de", ""], "Kunde@firma.de"),
    ).toEqual([{ email: "ben@firma.de", name: undefined }, { email: "cara@firma.de", name: "Cara" }]);
  });
});

describe.skipIf(!hasDb)("Kollegen mit einladen", async () => {
  const { db } = await import("@/lib/db");
  const { createBooking, BookingError } = await import("./booking");
  const { loadEventTypeById } = await import("./slots");
  const suffix = Date.now().toString(36);
  let orgId = "";
  let userId = "";
  let etId = "";
  const day = new Date(Date.now() + 15 * 86400_000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const at = (h: number) => new Date(`${day.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00:00Z`);

  beforeAll(async () => {
    const all = { start: "06:00", end: "20:00" };
    const user = await db.user.create({
      data: {
        name: "Gastgeberin",
        email: `gst-${suffix}@example.com`,
        schedule: { create: { timeZone: "UTC", weekly: { "1": [all], "2": [all], "3": [all], "4": [all], "5": [all] } } },
      },
    });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "Gäste", slug: `gst-${suffix}` } });
    orgId = org.id;
    const et = await db.eventType.create({
      data: { organizationId: org.id, slug: "x", title: "Beratung", minNoticeMin: 0, maxGuests: 2, hosts: { create: { userId } } },
    });
    etId = et.id;
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: orgId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("lädt Kollegen in den Kalender ein und schickt ihnen eine Mail", async () => {
    const et = (await loadEventTypeById(etId))!;
    mail.sendMail.mockClear();
    const booking = await createBooking(et, {
      start: at(10),
      name: "Kundin",
      email: "kundin@firma.de",
      timeZone: "UTC",
      guests: [{ email: "ben@firma.de", name: "Ben Kollege" }, "cara@firma.de"],
    });
    const input = google.createGoogleEvent.mock.calls.at(-1)![0] as { attendees: { email: string; displayName?: string }[] };
    expect(input.attendees).toEqual(
      expect.arrayContaining([
        { email: "kundin@firma.de", displayName: "Kundin" },
        { email: "ben@firma.de", displayName: "Ben Kollege" },
        { email: "cara@firma.de", displayName: undefined },
      ]),
    );
    const recipients = mail.sendMail.mock.calls.map((c) => c[0]);
    expect(recipients).toEqual(["kundin@firma.de", "ben@firma.de", "cara@firma.de"]);
    const benMail = mail.sendMail.mock.calls[1];
    expect(benMail[1]).toContain("Einladung: Beratung");
    expect(benMail[2]).toContain("Hallo Ben Kollege");
    expect(benMail[2]).toContain("Kundin hat dich");
    const attendees = await db.attendee.findMany({ where: { bookingId: booking.id, isGuest: true }, orderBy: { email: "asc" } });
    expect(attendees.map((a) => a.name)).toEqual(["Ben Kollege", "cara@firma.de"]);
  });

  it("hält das Limit pro Meeting-Typ ein", async () => {
    const et = (await loadEventTypeById(etId))!;
    await expect(
      createBooking(et, { start: at(14), name: "K", email: "k@firma.de", timeZone: "UTC", guests: ["a@x.de", "b@x.de", "c@x.de"] }),
    ).rejects.toBeInstanceOf(BookingError);
  });
});
