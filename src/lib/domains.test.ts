import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkDomainTxt, normalizeDomain } from "./domains";
import { middleware } from "@/middleware";

describe("Eigene Domains", () => {
  it("normalisiert und prüft Domains", () => {
    expect(normalizeDomain("https://Termine.Firma.de/pfad")).toBe("termine.firma.de");
    expect(normalizeDomain("termine.firma.de.")).toBe("termine.firma.de");
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("-x.de")).toBeNull();
    expect(normalizeDomain("a b.de")).toBeNull();
  });

  it("erkennt den TXT-Eintrag", async () => {
    const resolver = async (name: string) =>
      name === "_kalender.termine.firma.de" ? [["kalender-verify=", "abc"], ["v=spf1"]] : Promise.reject(new Error("ENOTFOUND"));
    expect(await checkDomainTxt("termine.firma.de", "abc", resolver)).toBe(true);
    expect(await checkDomainTxt("termine.firma.de", "xyz", resolver)).toBe(false);
    expect(await checkDomainTxt("andere.de", "abc", resolver)).toBe(false);
  });
});

describe("Middleware für eigene Domains", () => {
  process.env.APP_URL = "https://app.example.com";
  const run = (host: string, path: string) =>
    middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));

  it("lässt die App-Domain unverändert", () => {
    const res = run("app.example.com", "/beispiel");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("schreibt Kunden-Domains auf /site/<host> um", () => {
    expect(run("termine.firma.de", "/").headers.get("x-middleware-rewrite")).toBe("https://termine.firma.de/site/termine.firma.de");
    expect(run("termine.firma.de", "/beratung").headers.get("x-middleware-rewrite")).toBe(
      "https://termine.firma.de/site/termine.firma.de/beratung",
    );
  });

  it("lässt API und Buchungslinks durch und schickt das Dashboard zur App", () => {
    expect(run("termine.firma.de", "/api/slots").headers.get("x-middleware-rewrite")).toBeNull();
    expect(run("termine.firma.de", "/booking/abc").headers.get("x-middleware-rewrite")).toBeNull();
    const res = run("termine.firma.de", "/dashboard");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/dashboard");
  });
});
