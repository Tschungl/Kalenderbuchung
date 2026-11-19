import { resolveTxt } from "dns/promises";
import { db } from "@/lib/db";

/** Host der App selbst (aus APP_URL), z.B. "termine.example.com". */
export function appHost() {
  try {
    return new URL(process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").host.toLowerCase();
  } catch {
    return "localhost:3000";
  }
}

/** "https://Termine.Firma.de/" -> "termine.firma.de"; null, wenn ungültig. */
export function normalizeDomain(input: string): string | null {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (host.length > 253 || !/^(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/.test(host)) return null;
  return host;
}

export const verifyRecordName = (domain: string) => `_kalender.${domain}`;
export const verifyRecordValue = (token: string) => `kalender-verify=${token}`;

/** Prüft den TXT-Eintrag _kalender.<domain> = kalender-verify=<token>. */
export async function checkDomainTxt(domain: string, token: string, resolver = resolveTxt) {
  try {
    const records = await resolver(verifyRecordName(domain));
    return records.some((chunks) => chunks.join("") === verifyRecordValue(token));
  } catch {
    return false;
  }
}

/** Für Caddy "on_demand_tls ask": nur für bekannte, geprüfte Domains Zertifikate holen. */
export async function isServedDomain(domain: string) {
  const host = domain.toLowerCase();
  if (host === appHost().replace(/:\d+$/, "")) return true;
  const org = await db.organization.findUnique({ where: { customDomain: host }, select: { domainVerifiedAt: true } });
  return !!org?.domainVerifiedAt;
}

export async function orgByDomain(host: string) {
  return db.organization.findFirst({
    where: { customDomain: host.toLowerCase(), domainVerifiedAt: { not: null } },
    include: { eventTypes: { where: { active: true }, orderBy: { createdAt: "asc" } } },
  });
}
