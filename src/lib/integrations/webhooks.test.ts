import { createHmac } from "crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { isAllowedWebhookUrl, signPayload } from "./webhooks";

describe("Webhook-Signatur", () => {
  it("signiert t.body mit HMAC-SHA256", () => {
    const sig = signPayload("geheim", '{"a":1}', 1700000000);
    const expected = createHmac("sha256", "geheim").update('1700000000.{"a":1}').digest("hex");
    expect(sig).toBe(`t=1700000000,v1=${expected}`);
  });
});

describe("Webhook-Ziele", () => {
  const env = process.env.NODE_ENV;
  afterAll(() => vi.stubEnv("NODE_ENV", env ?? "test"));

  it("sperrt in Produktion interne Adressen und http", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isAllowedWebhookUrl("https://hooks.example.com/x")).toBe(true);
    expect(isAllowedWebhookUrl("http://hooks.example.com/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://localhost/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://127.0.0.1/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://10.1.2.3/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://172.20.0.1/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://192.168.1.1/x")).toBe(false);
    expect(isAllowedWebhookUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedWebhookUrl("kein url")).toBe(false);
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Webhook-Auslieferung", async () => {
  const { db } = await import("@/lib/db");
  const { emitWebhook } = await import("./webhooks");
  const suffix = Date.now().toString(36);
  let orgId = "";

  afterAll(async () => {
    if (orgId) await db.organization.delete({ where: { id: orgId } });
    vi.unstubAllGlobals();
  });

  it("schickt nur an passende, aktive Webhooks und protokolliert", async () => {
    const org = await db.organization.create({ data: { name: "Hook", slug: `hook-${suffix}` } });
    orgId = org.id;
    const a = await db.webhook.create({
      data: { organizationId: org.id, url: "https://a.example.com/h", secret: "s1", events: ["booking.created"] },
    });
    await db.webhook.create({
      data: { organizationId: org.id, url: "https://b.example.com/h", secret: "s2", events: ["booking.cancelled"] },
    });
    await db.webhook.create({
      data: { organizationId: org.id, url: "https://c.example.com/h", secret: "s3", events: ["booking.created"], active: false },
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await emitWebhook(org.id, "booking.created", { id: "b1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://a.example.com/h");
    const headers = init.headers as Record<string, string>;
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]+)$/.exec(headers["X-Kalender-Signature"])!;
    expect(createHmac("sha256", "s1").update(`${t}.${init.body}`).digest("hex")).toBe(v1);
    expect(JSON.parse(String(init.body))).toMatchObject({ event: "booking.created", data: { id: "b1" } });
    const deliveries = await db.webhookDelivery.findMany({ where: { webhookId: a.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].statusCode).toBe(200);
  });

  it("wirft nie, auch wenn das Ziel nicht erreichbar ist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    await expect(emitWebhook(orgId, "booking.created", {})).resolves.toBeUndefined();
    const last = await db.webhookDelivery.findFirst({ where: { webhook: { organizationId: orgId } }, orderBy: { createdAt: "desc" } });
    expect(last?.error).toContain("ECONNREFUSED");
  });
});
