import { describe, expect, it } from "vitest";
import { t } from "./salutation";

describe("Anrede", () => {
  it("Sie ist Standard, Du nur wenn eingestellt", () => {
    expect(t(undefined).yourName).toBe("Ihr Name");
    expect(t("SIE").hello("Kim")).toBe("Guten Tag Kim,");
    expect(t("DU").hello("Kim")).toBe("Hallo Kim,");
    expect(t("DU").yourTimeZone).toBe("Zeiten in deiner Zeitzone");
  });

  it("beide Varianten haben dieselben Texte", () => {
    expect(Object.keys(t("DU")).sort()).toEqual(Object.keys(t("SIE")).sort());
  });

  it("Sie-Texte enthalten keine Du-Formen", () => {
    const sie = t("SIE");
    const all = Object.values(sie)
      .map((v) => (typeof v === "function" ? (v as (...a: string[]) => string)("X", "Y", "Z", "") : v))
      .join(" ");
    expect(all).not.toMatch(/\b(du|dich|dir|dein|deine|deinen|deiner)\b/i);
  });
});
