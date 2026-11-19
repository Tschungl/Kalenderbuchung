import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integrationstest des Agenten mit echter Datenbank und geskripteten
 * Claude-Antworten. Prüft vor allem, dass die Werkzeuge serverseitig
 * gegen die Regeln validieren.
 */
const hasDb = !!process.env.DATABASE_URL;
const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = { messages: { create } };
  },
}));
vi.mock("@/lib/google", () => ({
  getGoogleBusy: vi.fn(async () => []),
  createGoogleEvent: vi.fn(async () => ({ eventId: "evt_1", meetUrl: "https://meet.example/abc" })),
  cancelGoogleEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mail", async (orig) => ({
  ...(await orig<typeof import("@/lib/mail")>()),
  sendMail: vi.fn(async () => undefined),
}));

function nextMondayBerlin(): string {
  const d = new Date(Date.now() + 7 * 86400_000);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const toolUse = (id: string, name: string, input: unknown) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input }],
});
const text = (t: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] });

describe.skipIf(!hasDb)("KI-Verhandlung", async () => {
  const { db } = await import("@/lib/db");
  const { runNegotiationTurn } = await import("./agent");
  const suffix = Date.now().toString(36);
  const monday = nextMondayBerlin();
  // Winter-/Sommerzeit egal: wir lesen die Slots aus dem Werkzeugergebnis
  let orgId = "";
  let userId = "";
  let negId = "";

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const user = await db.user.create({
      data: {
        name: "Gastgeber",
        email: `host-${suffix}@example.com`,
        schedule: { create: { timeZone: "Europe/Berlin", weekly: { "1": [{ start: "09:00", end: "17:00" }] } } },
      },
    });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "Test", slug: `neg-${suffix}` } });
    orgId = org.id;
    const et = await db.eventType.create({
      data: {
        organizationId: org.id,
        slug: "beratung",
        title: "Beratung",
        durationMin: 60,
        slotStepMin: 60,
        minNoticeMin: 0,
        negotiation: { enabled: true, extendedStart: "08:00", extendedEnd: "19:00", autoBookExtended: false },
        hosts: { create: { userId: user.id } },
      },
    });
    const neg = await db.negotiation.create({
      data: { organizationId: org.id, eventTypeId: et.id, customerName: "Kim", customerEmail: `kim-${suffix}@example.com`, timeZone: "Europe/Berlin" },
    });
    negId = neg.id;
  });

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: orgId } });
    await db.booking.deleteMany({ where: { hostId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("schlägt nur geprüfte Zeiten vor", async () => {
    let checked: { start: string; kind: string }[] = [];
    create
      .mockResolvedValueOnce(toolUse("t1", "check_availability", { from_date: monday, to_date: monday }))
      .mockImplementationOnce(async ({ messages }) => {
        const last = messages.at(-1).content[0].content;
        checked = JSON.parse(last).slots;
        const regular = checked.find((s) => s.kind === "regular")!;
        return toolUse("t2", "propose_times", { starts: [regular.start, "2030-01-01T10:00:00.000Z"] });
      })
      .mockResolvedValueOnce(text("Wie wäre es hiermit?"));

    const res = await runNegotiationTurn(negId, "Montag abends?");
    expect(checked.some((s) => s.kind === "regular")).toBe(true);
    expect(checked.some((s) => s.kind === "approval")).toBe(true);
    const last = res.transcript.at(-1)!;
    expect(last.text).toBe("Wie wäre es hiermit?");
    expect(last.proposals).toHaveLength(1); // erfundene Zeit wurde verworfen
  });

  it("bucht keine Freigabe-Zeit direkt, sondern fragt den Gastgeber", async () => {
    const neg = await db.negotiation.findUniqueOrThrow({ where: { id: negId } });
    const approvalSlot = (neg.knownSlots as { start: string; kind: string }[]).find((s) => s.kind === "approval")!;
    let bookResult = "";
    create
      .mockResolvedValueOnce(toolUse("t3", "book_time", { start: approvalSlot.start }))
      .mockImplementationOnce(async ({ messages }) => {
        bookResult = messages.at(-1).content[0].content;
        return toolUse("t4", "request_host_approval", { start: approvalSlot.start, reason: "Nur abends Zeit" });
      })
      .mockResolvedValueOnce(text("Ich frage beim Gastgeber nach."));

    const res = await runNegotiationTurn(negId, "Dann die Abendzeit bitte.");
    expect(bookResult).toContain("Zustimmung");
    expect(res.status).toBe("AWAITING_APPROVAL");
    expect(await db.booking.count({ where: { hostId: userId } })).toBe(0);
  });

  it("Freigabe durch den Gastgeber bucht den Termin", async () => {
    const { decideApproval } = await import("./approval");
    const neg = await db.negotiation.findUniqueOrThrow({ where: { id: negId } });
    const result = await decideApproval(neg.approvalToken!, true);
    expect(result.message).toContain("Freigegeben");
    const after = await db.negotiation.findUniqueOrThrow({ where: { id: negId } });
    expect(after.status).toBe("BOOKED");
    expect(await db.booking.count({ where: { hostId: userId, status: "CONFIRMED" } })).toBe(1);
  });
});
