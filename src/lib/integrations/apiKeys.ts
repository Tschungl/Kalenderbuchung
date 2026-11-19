import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Neuer Schlüssel; der Klartext wird nur einmal zurückgegeben. */
export function generateApiKey() {
  const key = `kb_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 9), hash: hashKey(key) };
}

/** Prüft "Authorization: Bearer kb_..." und liefert die Organisation oder null. */
export async function authenticateApiKey(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(kb_[A-Za-z0-9_-]+)$/.exec(header.trim());
  if (!match) return null;
  const apiKey = await db.apiKey.findUnique({ where: { hash: hashKey(match[1]) }, include: { organization: true } });
  if (!apiKey) return null;
  // lastUsedAt höchstens minütlich schreiben
  if (!apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return apiKey.organization;
}
