import { describe, expect, it } from "vitest";
import { computeSlots, pickRoundRobinHost, workingIntervals, type WeeklyHours } from "./availability";

const weekly: WeeklyHours = { "1": [{ start: "09:00", end: "12:00" }] }; // nur Montag 9-12
// Montag, 7. Dezember 2026 (Winterzeit, Berlin = UTC+1)
const monday = new Date("2026-12-07T00:00:00Z");
const nextDay = new Date("2026-12-08T00:00:00Z");
const now = new Date("2026-12-01T00:00:00Z");

describe("workingIntervals", () => {
  it("rechnet Wochenzeiten in die Zeitzone um", () => {
    const iv = workingIntervals({ timeZone: "Europe/Berlin", weekly }, monday, nextDay);
    expect(iv).toHaveLength(1);
    expect(iv[0].start.toISOString()).toBe("2026-12-07T08:00:00.000Z");
    expect(iv[0].end.toISOString()).toBe("2026-12-07T11:00:00.000Z");
  });

  it("berücksichtigt Ausnahmen (z.B. Urlaub)", () => {
    const iv = workingIntervals(
      { timeZone: "Europe/Berlin", weekly, overrides: [{ date: "2026-12-07", intervals: [] }] },
      monday,
      nextDay,
    );
    expect(iv).toHaveLength(0);
  });
});

describe("computeSlots", () => {
  const base = {
    durationMin: 60,
    stepMin: 60,
    rangeStart: monday,
    rangeEnd: nextDay,
    now,
  };

  it("liefert Stundenslots innerhalb der Arbeitszeit", () => {
    const slots = computeSlots({
      ...base,
      mode: "SINGLE",
      hosts: [{ id: "a", timeZone: "Europe/Berlin", weekly, busy: [] }],
    });
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-12-07T08:00:00.000Z",
      "2026-12-07T09:00:00.000Z",
      "2026-12-07T10:00:00.000Z",
    ]);
  });

  it("blockiert belegte Zeiten inklusive Puffer", () => {
    const slots = computeSlots({
      ...base,
      mode: "SINGLE",
      bufferAfterMin: 15,
      hosts: [
        {
          id: "a",
          timeZone: "Europe/Berlin",
          weekly,
          busy: [{ start: new Date("2026-12-07T09:00:00Z"), end: new Date("2026-12-07T09:30:00Z") }],
        },
      ],
    });
    // 08:00-09:00 + 15 min Puffer überschneidet den Termin ab 09:00 -> fällt weg
    expect(slots.map((s) => s.start.toISOString())).toEqual(["2026-12-07T10:00:00.000Z"]);
  });

  it("Kollektiv: nur Zeiten, an denen alle frei sind", () => {
    const slots = computeSlots({
      ...base,
      mode: "COLLECTIVE",
      hosts: [
        { id: "a", timeZone: "Europe/Berlin", weekly, busy: [] },
        {
          id: "b",
          timeZone: "Europe/Berlin",
          weekly,
          busy: [{ start: new Date("2026-12-07T08:00:00Z"), end: new Date("2026-12-07T09:00:00Z") }],
        },
      ],
    });
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.hostIds.length === 2)).toBe(true);
  });

  it("Round Robin: Slot frei, wenn mindestens einer frei ist", () => {
    const slots = computeSlots({
      ...base,
      mode: "ROUND_ROBIN",
      hosts: [
        { id: "a", timeZone: "Europe/Berlin", weekly, busy: [] },
        {
          id: "b",
          timeZone: "Europe/Berlin",
          weekly,
          busy: [{ start: new Date("2026-12-07T08:00:00Z"), end: new Date("2026-12-07T09:00:00Z") }],
        },
      ],
    });
    expect(slots).toHaveLength(3);
    expect(slots[0].hostIds).toEqual(["a"]);
  });

  it("respektiert die Mindestvorlaufzeit", () => {
    const slots = computeSlots({
      ...base,
      now: new Date("2026-12-07T08:30:00Z"),
      minNoticeMin: 60,
      mode: "SINGLE",
      hosts: [{ id: "a", timeZone: "Europe/Berlin", weekly, busy: [] }],
    });
    expect(slots.map((s) => s.start.toISOString())).toEqual(["2026-12-07T10:00:00.000Z"]);
  });
});

describe("pickRoundRobinHost", () => {
  it("nimmt den Gastgeber mit den wenigsten Buchungen", () => {
    expect(
      pickRoundRobinHost([
        { id: "a", weight: 1, bookingCount: 5 },
        { id: "b", weight: 1, bookingCount: 2 },
      ]),
    ).toBe("b");
  });
});
