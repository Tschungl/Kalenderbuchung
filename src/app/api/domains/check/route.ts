import { isServedDomain } from "@/lib/domains";

/**
 * Für Caddy (on_demand_tls ask): 200 = Zertifikat ausstellen, 404 = nicht.
 * So bekommt jede geprüfte Kunden-Domain automatisch HTTPS, fremde Domains nicht.
 */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain") ?? "";
  return new Response(null, { status: domain && (await isServedDomain(domain)) ? 200 : 404 });
}
