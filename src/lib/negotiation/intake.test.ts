import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { intakeSummary, missingIntake, parseIntake } from "./intake";

const hasDb = !!process.env.DATABASE_URL;
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));
const google = vi.hoisted(() => ({
  getGoogleBusy: vi.fn(async () => []),
  createGoogleEvent: vi.fn(async (_input: { attendees: { email: string }[]; description?: string }) => ({ eventId: "evt_i", meetUrl: "https://meet.example/i" })),
  cancelGoogleEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/google", () => google);
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: vi.fn(async () => undefined) }));

const toolUse = (id: string, name: string, input: unknown) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }] });
const text = (t: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });

const CONFIG = {
  enabled: true,
  questions: [
    { id: "it", text: "Wer aus der IT nimmt teil?", kind: "participant", required: true },
    { id: "ziel", text: "Was ist das Ziel des Projekts?", kind: "text", required: true },
    { id: "budget", text: "Gibt es ein Budget?", kind: "text", required: false },
  ],
};

describe("Vorabfragen-Regeln", () => {
  it("erkennt fehlende Pflichtfragen", () => {
    const c = parseIntake(CONFIG);
    expect(missingIntake(c, [], []).map((q) => q.id)).toEqual(["it", "ziel"]);
    expect(
      missingIntake(c, [{ questionId: "ziel", question: "", answer: "CRM-Einführung" }], [{ email: "it@firma.de", questionId: "it" }]),
    ).toEqual([]);
    expect(intakeSummary([{ questionId: "ziel", question: "", answer: "CRM" }], [{ name: "Ida", email: "it@firma.de", questionId: "it" }], c)).toContain(
      "Wer aus der IT nimmt teil?: Ida <it@firma.de>",
    );
  });

  it("ungültige Konfiguration wird zu ausgeschaltet", () => {
    expect(parseIntake({ enabled: "ja" }).enabled).toBe(false);
  });
});

describe.skipIf(!hasDb)("Assistent mit Vorabfragen", async () => {
  const { db } = await import("@/lib/db");
  const { runNegotiationTurn } = await import("./agent");
  const suffix = Date.now().toString(36);
  let orgId = "";
  let userId = "";
  let negId = "";
  const day = new Date(Date.now() + 17 * 86400_000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const start = new Date(`${day.toISOString().slice(0, 10)}T10:00:00Z`).toISOString();

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const all = { start: "06:00", end: "20:00" };
    const user = await db.user.create({
      data: {
        name: "Gastgeber",
        email: `intake-${suffix}@example.com`,
        schedule: { create: { timeZone: "UTC", weekly: { "1": [all], "2": [all], "3": [all], "4": [all], "5": [all] } } },
      },
    });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "Kickoff GmbH", slug: `intake-${suffix}` } });
    orgId = org.id;
    const et = await db.eventType.create({
      data: { organizationId: org.id, slug: "kickoff", title: "Kick-Off", minNoticeMin: 0, intake: CONFIG, hosts: { create: { userId } } },
    });
    const neg = await db.negotiation.create({
      data: {
        organizationId: org.id,
        eventTypeId: et.id,
        customerName: "Kim",
        customerEmail: "kim@kunde.de",
        timeZone: "UTC",
        preferredStart: new Date(start),
        knownSlots: [{ start, end: new Date(new Date(start).getTime() + 1800_000).toISOString(), kind: "regular" }],
      },
    });
    negId = neg.id;
  });

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: orgId } });
    await db.booking.deleteMany({ where: { hostId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("bucht erst, wenn die Pflichtfragen geklärt sind, und lädt die IT-Person mit ein", async () => {
    let blocked = "";
    create
      .mockImplementationOnce(async ({ system, tools }) => {
        expect(system).toContain("[it] Wer aus der IT nimmt teil?");
        expect(tools.map((t: { name: string }) => t.name)).toContain("add_participant");
        return toolUse("a1", "book_time", { start });
      })
      .mockImplementationOnce(async ({ messages }) => {
        blocked = messages.at(-1).content[0].content;
        return text("Wer aus der IT ist dabei, und was ist das Ziel?");
      });
    const first = await runNegotiationTurn(negId, "[Start]", { hidden: true });
    expect(JSON.parse(blocked).missing.map((m: { id: string }) => m.id)).toEqual(["it", "ziel"]);
    expect(first.transcript).toHaveLength(1); // versteckte Startnachricht erscheint nicht

    let badEmail = "";
    create
      .mockResolvedValueOnce(toolUse("a2", "add_participant", { question_id: "it", name: "Ida", email: "keine-mail" }))
      .mockImplementationOnce(async ({ messages }) => {
        badEmail = messages.at(-1).content[0].content;
        return toolUse("a3", "add_participant", { question_id: "it", name: "Ida IT", email: "ida@kunde.de" });
      })
      .mockResolvedValueOnce(toolUse("a4", "record_answer", { question_id: "ziel", answer: "CRM-Einführung" }))
      .mockResolvedValueOnce(toolUse("a5", "book_time", { start }))
      .mockResolvedValueOnce(text("Gebucht!"));
    const res = await runNegotiationTurn(negId, "Ida IT, ida@kunde.de. Ziel ist die CRM-Einführung. Bitte buchen.");
    expect(badEmail).toContain("Ungültige E-Mail");
    expect(res.status).toBe("BOOKED");

    const booking = await db.booking.findFirstOrThrow({ where: { hostId: userId }, include: { attendees: true } });
    expect(booking.attendees.map((a) => [a.email, a.isGuest]).sort()).toEqual([
      ["ida@kunde.de", true],
      ["kim@kunde.de", false],
    ]);
    expect(booking.intakeAnswers).toEqual([{ questionId: "ziel", question: "Was ist das Ziel des Projekts?", answer: "CRM-Einführung" }]);
    expect(booking.notes).toContain("Wer aus der IT nimmt teil?: Ida IT <ida@kunde.de>");
    expect(google.createGoogleEvent.mock.calls.at(-1)![0].description).toContain("Vorabfragen:");
  });
});
