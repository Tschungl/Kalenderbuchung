import { describe, expect, it } from "vitest";
import { computeSlots } from "@/lib/availability";
import { classifySlots, extendWeekly, parseRules } from "./rules";

const weekly = { "1": [{ start: "09:00", end: "17:00" }] };

describe("Verhandlungsregeln", () => {
  it("füllt Standardwerte und ignoriert Unsinn", () => {
    expect(parseRules(null).enabled).toBe(false);
    expect(parseRules({ enabled: true, extendedEnd: "kaputt" }).enabled).toBe(false); // ungültig -> Standard
    expect(parseRules({ enabled: true }).extendedEnd).toBe("19:00");
  });

  it("erweitert Werktage, Wochenende nur wenn erlaubt", () => {
    const rules = parseRules({ enabled: true, extendedStart: "08:00", extendedEnd: "19:00" });
    const ext = extendWeekly(weekly, rules);
    expect(ext["1"]).toEqual([{ start: "08:00", end: "19:00" }]);
    expect(ext["2"]).toEqual([{ start: "08:00", end: "19:00" }]);
    expect(ext["6"]).toBeUndefined();
    expect(extendWeekly(weekly, { ...rules, allowWeekends: true })["6"]).toBeDefined();
  });

  it("ordnet Slots als regulär, automatisch oder mit Freigabe ein", () => {
    const base = {
      mode: "SINGLE" as const,
      durationMin: 60,
      stepMin: 60,
      rangeStart: new Date("2026-12-07T00:00:00Z"),
      rangeEnd: new Date("2026-12-08T00:00:00Z"),
      now: new Date("2026-12-01T00:00:00Z"),
    };
    const rules = parseRules({ enabled: true, extendedStart: "08:00", extendedEnd: "19:00" });
    const regular = computeSlots({ ...base, hosts: [{ id: "a", timeZone: "Europe/Berlin", weekly, busy: [] }] });
    const extended = computeSlots({
      ...base,
      hosts: [{ id: "a", timeZone: "Europe/Berlin", weekly: extendWeekly(weekly, rules), busy: [] }],
    });
    const classified = classifySlots(regular, extended, rules, "Europe/Berlin");
    const kindAt = (iso: string) => classified.find((c) => c.start === iso)?.kind;
    expect(kindAt("2026-12-07T09:00:00.000Z")).toBe("regular"); // 10 Uhr Berlin
    expect(kindAt("2026-12-07T07:00:00.000Z")).toBe("approval"); // 8 Uhr Berlin
    expect(kindAt("2026-12-07T17:00:00.000Z")).toBe("approval"); // 18 Uhr Berlin

    const auto = classifySlots(regular, extended, { ...rules, autoBookExtended: true }, "Europe/Berlin");
    expect(auto.find((c) => c.start === "2026-12-07T17:00:00.000Z")?.kind).toBe("auto");
  });
});
