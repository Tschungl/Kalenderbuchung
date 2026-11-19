import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Outlook / Microsoft Graph", async () => {
  const { db } = await import("@/lib/db");
  const ms = await import("./microsoft");
  const { providerFor } = await import("./calendar");
  const suffix = Date.now().toString(36);
  let userId = "";
  const calls: { url: string; init?: RequestInit }[] = [];

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        email: `ms-${suffix}@example.com`,
        accounts: {
          create: {
            type: "oidc",
            provider: ms.MS_PROVIDER,
            providerAccountId: `ms-${suffix}`,
            access_token: "alt",
            refresh_token: "refresh-1",
            expires_at: Math.floor(Date.now() / 1000) - 10, // abgelaufen
          },
        },
      },
    });
    userId = user.id;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("/oauth2/v2.0/token")) {
          return Response.json({ access_token: "neu", refresh_token: "refresh-2", expires_in: 3600 });
        }
        if (url.includes("/me/calendarView")) {
          return Response.json({
            value: [
              { showAs: "busy", start: { dateTime: "2030-03-04T09:00:00.0000000" }, end: { dateTime: "2030-03-04T10:00:00.0000000" } },
              { showAs: "free", start: { dateTime: "2030-03-04T11:00:00.0000000" }, end: { dateTime: "2030-03-04T12:00:00.0000000" } },
              { showAs: "busy", isCancelled: true, start: { dateTime: "2030-03-04T13:00:00" }, end: { dateTime: "2030-03-04T14:00:00" } },
            ],
          });
        }
        if (url.endsWith("/me/events")) {
          const body = JSON.parse(String(init?.body));
          if (body.isOnlineMeeting) return new Response("Teams nicht verfügbar", { status: 400 });
          return Response.json({ id: "evt-ms-1", onlineMeeting: null });
        }
        if (url.includes("/cancel")) return new Response(null, { status: 202 });
        return new Response("unerwartet", { status: 500 });
      }),
    );
  });

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    vi.unstubAllGlobals();
  });

  it("erkennt Outlook als Kalender des Users", async () => {
    expect(await providerFor(userId)).toBe("microsoft");
  });

  it("erneuert abgelaufene Tokens und liest nur belegte Zeiten", async () => {
    const busy = await ms.getMicrosoftBusy(userId, new Date("2030-03-04T00:00:00Z"), new Date("2030-03-05T00:00:00Z"));
    expect(busy).toEqual([{ start: new Date("2030-03-04T09:00:00Z"), end: new Date("2030-03-04T10:00:00Z") }]);
    const account = await db.account.findFirst({ where: { userId } });
    expect(account?.access_token).toBe("neu");
    expect(account?.refresh_token).toBe("refresh-2");
    const graphCall = calls.find((c) => c.url.includes("calendarView"));
    expect((graphCall?.init?.headers as Record<string, string>).Authorization).toBe("Bearer neu");
  });

  it("legt Termine an und fällt ohne Teams auf normale Termine zurück", async () => {
    const res = await ms.createMicrosoftEvent({
      organizerUserId: userId,
      summary: "Beratung",
      start: new Date("2030-03-04T09:00:00Z"),
      end: new Date("2030-03-04T09:30:00Z"),
      timeZone: "Europe/Berlin",
      attendees: [{ email: "kunde@example.com", displayName: "Kunde" }],
      withMeet: true,
      requestId: "r1",
    });
    expect(res).toEqual({ eventId: "evt-ms-1", meetUrl: null });
    const posts = calls.filter((c) => c.url.endsWith("/me/events"));
    expect(posts).toHaveLength(2);
    expect(JSON.parse(String(posts[1].init?.body)).attendees[0].emailAddress.address).toBe("kunde@example.com");
    await ms.cancelMicrosoftEvent(userId, "evt-ms-1");
    expect(calls.at(-1)?.url).toContain("/me/events/evt-ms-1/cancel");
  });
});
