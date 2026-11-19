import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;
const sendMail = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail }));

describe.skipIf(!hasDb)("Erinnerungen", async () => {
  const { db } = await import("@/lib/db");
  const { sendDueReminders } = await import("./reminders");
  const suffix = Date.now().toString(36);
  const now = new Date("2030-03-04T08:00:00Z");
  let orgId = "";
  let userId = "";

  beforeAll(async () => {
    const user = await db.user.create({ data: { name: "Gastgeberin", email: `rem-${suffix}@example.com` } });
    userId = user.id;
    const org = await db.organization.create({
      data: { name: "Erinnerung", slug: `rem-${suffix}`, reminderOffsetsMin: [1440, 60] },
    });
    orgId = org.id;
    const et = await db.eventType.create({ data: { organizationId: org.id, slug: "x", title: "Beratung" } });
    const mk = (startIso: string, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED", createdAt = new Date("2030-03-01T00:00:00Z")) =>
      db.booking.create({
        data: {
          organizationId: org.id,
          eventTypeId: et.id,
          hostId: user.id,
          startTime: new Date(startIso),
          endTime: new Date(new Date(startIso).getTime() + 30 * 60_000),
          status,
          createdAt,
          attendees: { create: [{ name: "Kunde", email: `kunde-${suffix}@example.com` }] },
        },
      });
    await mk("2030-03-05T08:00:00Z"); // genau 24 h -> fällig (1440)
    await mk("2030-03-04T08:50:00Z"); // in 50 min -> fällig (60)
    await mk("2030-03-04T12:00:00Z"); // in 4 h -> nichts
    await mk("2030-03-05T08:00:00Z", "CANCELLED"); // abgesagt -> nichts
    await mk("2030-03-04T08:45:00Z", "CONFIRMED", new Date("2030-03-04T07:58:00Z")); // gerade erst gebucht -> nichts
  });

  afterAll(async () => {
    await db.organization.delete({ where: { id: orgId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("verschickt fällige Erinnerungen genau einmal", async () => {
    expect(await sendDueReminders(now)).toBe(2);
    // je Buchung an Kunde und Gastgeberin
    expect(sendMail).toHaveBeenCalledTimes(4);
    const subjects = sendMail.mock.calls.map((c) => String(c[1]));
    expect(subjects.filter((s) => s.includes("morgen"))).toHaveLength(2);
    expect(subjects.filter((s) => s.includes("in einer Stunde"))).toHaveLength(2);

    sendMail.mockClear();
    expect(await sendDueReminders(new Date(now.getTime() + 60_000))).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
