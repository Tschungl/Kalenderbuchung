import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;
vi.mock("@/lib/google", () => ({
  getGoogleBusy: vi.fn(async () => []),
  createGoogleEvent: vi.fn(async (input: { withMeet: boolean; location?: string }) => ({
    eventId: `evt_${Math.random()}`,
    meetUrl: input.withMeet ? "https://meet.example/x" : null,
  })),
  cancelGoogleEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: vi.fn(async () => undefined) }));

describe.skipIf(!hasDb)("Zoom und Teams als Ort", async () => {
  const { db } = await import("@/lib/db");
  const { createBooking, cancelBooking } = await import("./booking");
  const { planConference } = await import("./conference");
  const { loadEventTypeById } = await import("./slots");
  const google = await import("@/lib/google");
  const suffix = Date.now().toString(36);
  let orgId = "";
  let userId = "";
  let etId = "";
  const day = new Date(Date.now() + 16 * 86400_000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const at = (h: number) => new Date(`${day.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00:00Z`);
  const meeting = { topic: "T", start: at(9), durationMin: 30, timeZone: "UTC", seed: "x" };

  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/users/me/meetings") && init?.method === "POST") {
      return new Response(JSON.stringify({ id: 81234567890, join_url: "https://zoom.us/j/81234567890" }), { status: 201 });
    }
    if (u.includes("/meetings/81234567890") && init?.method === "DELETE") return new Response(null, { status: 204 });
    if (u.endsWith("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "neu", refresh_token: "r2", expires_in: 3600 }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });

  beforeAll(async () => {
    process.env.ZOOM_CLIENT_ID = "id";
    process.env.ZOOM_CLIENT_SECRET = "secret";
    vi.stubGlobal("fetch", fetchMock);
    const all = { start: "06:00", end: "20:00" };
    const user = await db.user.create({
      data: {
        name: "Zoomerin",
        email: `zoom-${suffix}@example.com`,
        schedule: { create: { timeZone: "UTC", weekly: { "1": [all], "2": [all], "3": [all], "4": [all], "5": [all] } } },
      },
    });
    userId = user.id;
    const org = await db.organization.create({ data: { name: "Zoom", slug: `zoom-${suffix}` } });
    orgId = org.id;
    const et = await db.eventType.create({
      data: { organizationId: org.id, slug: "z", title: "Zoom-Call", minNoticeMin: 0, locationType: "ZOOM", hosts: { create: { userId } } },
    });
    etId = et.id;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.organization.delete({ where: { id: orgId } });
    await db.user.delete({ where: { id: userId } });
  });

  it("nimmt ohne Zoom-Verbindung den festen Link", async () => {
    expect(await planConference({ locationType: "ZOOM", locationValue: "https://zoom.us/j/111" }, userId, meeting)).toMatchObject({
      withMeet: false,
      meetingUrl: "https://zoom.us/j/111",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Teams bei Google-Gastgeber: fester Link, kein Meet", async () => {
    const plan = await planConference({ locationType: "MS_TEAMS", locationValue: "https://teams.microsoft.com/l/abc" }, userId, meeting);
    expect(plan).toMatchObject({ withMeet: false, meetingUrl: "https://teams.microsoft.com/l/abc" });
  });

  it("legt mit Zoom-Verbindung ein Meeting an und löscht es bei Absage", async () => {
    // abgelaufenes Token: wird vorher erneuert
    await db.zoomConnection.create({
      data: { userId, zoomUserId: "z1", accessToken: "alt", refreshToken: "r1", expiresAt: new Date(Date.now() - 1000) },
    });
    const et = (await loadEventTypeById(etId))!;
    const booking = await createBooking(et, { start: at(10), name: "Kunde", email: "k@example.com", timeZone: "UTC", guests: [] });
    expect(booking.meetingUrl).toBe("https://zoom.us/j/81234567890");
    expect(booking.zoomMeetingId).toBe("81234567890");
    const calInput = vi.mocked(google.createGoogleEvent).mock.calls.at(-1)![0];
    expect(calInput).toMatchObject({ withMeet: false, location: "https://zoom.us/j/81234567890" });
    expect(calInput.description).toContain("Zoom: https://zoom.us/j/81234567890");
    const conn = await db.zoomConnection.findUnique({ where: { userId } });
    expect(conn?.accessToken).toBe("neu");

    await cancelBooking(booking.manageToken);
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes("/meetings/81234567890") && i?.method === "DELETE")).toBe(true);
  });
});
