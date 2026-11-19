import { afterAll, describe, expect, it } from "vitest";
import { generateApiKey, hashKey } from "./apiKeys";

describe("API-Schlüssel", () => {
  it("erzeugt kb_-Schlüssel und speichert nur den Hash", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key).toMatch(/^kb_[A-Za-z0-9_-]{32}$/);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashKey(key));
    expect(hash).not.toContain(key);
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("API-Authentifizierung", async () => {
  const { db } = await import("@/lib/db");
  const { authenticateApiKey } = await import("./apiKeys");
  const suffix = Date.now().toString(36);
  const org = await db.organization.create({ data: { name: "API", slug: `api-${suffix}` } });
  const { key, prefix, hash } = generateApiKey();
  await db.apiKey.create({ data: { organizationId: org.id, name: "Test", prefix, hash } });

  afterAll(() => db.organization.delete({ where: { id: org.id } }));

  const req = (auth?: string) => new Request("http://x/api/v1/bookings", { headers: auth ? { authorization: auth } : {} });

  it("akzeptiert gültige Schlüssel und lehnt alles andere ab", async () => {
    expect((await authenticateApiKey(req(`Bearer ${key}`)))?.id).toBe(org.id);
    expect(await authenticateApiKey(req())).toBeNull();
    expect(await authenticateApiKey(req(`Bearer ${key}x`))).toBeNull();
    expect(await authenticateApiKey(req(`Basic ${key}`))).toBeNull();
    const stored = await db.apiKey.findFirst({ where: { organizationId: org.id } });
    expect(stored?.lastUsedAt).not.toBeNull();
  });
});
