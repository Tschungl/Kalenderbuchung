import { describe, expect, it } from "vitest";
import { computeStats, type StatBooking } from "./stats";

const b = (id: string, iso: string, extra: Partial<StatBooking> = {}): StatBooking => ({
  id,
  status: "CONFIRMED",
  startTime: new Date(iso),
  eventTypeId: "et1",
  hostId: "h1",
  rescheduledFromId: null,
  ...extra,
});

describe("Statistik", () => {
  it("zählt Verschiebungen nicht als Absage", () => {
    const s = computeStats(
      [
        b("a", "2030-03-04T08:00:00Z"), // Mo 9 Uhr Berlin
        b("b", "2030-03-05T13:00:00Z", { status: "CANCELLED" }), // echte Absage
        b("c", "2030-03-06T09:00:00Z", { status: "CANCELLED" }), // verschoben ->
        b("d", "2030-03-07T09:00:00Z", { rescheduledFromId: "c", hostId: "h2", eventTypeId: "et2" }),
      ],
      [{ status: "BOOKED" }, { status: "OPEN" }, { status: "AWAITING_APPROVAL" }, { status: "BOOKED" }],
    );
    expect(s.booked).toBe(3);
    expect(s.cancelled).toBe(1);
    expect(s.rescheduled).toBe(1);
    expect(s.active).toBe(2);
    expect(s.cancelRate).toBeCloseTo(1 / 3);
    expect(s.byWeekday.find((d) => d.label === "Mo")?.value).toBe(1);
    expect(s.byWeekday.find((d) => d.label === "Do")?.value).toBe(1);
    expect(s.byHour).toEqual([
      { label: "09 Uhr", value: 1 },
      { label: "10 Uhr", value: 1 },
    ]);
    expect(s.byHost).toEqual([
      ["h1", 1],
      ["h2", 1],
    ]);
    expect(s.negotiations).toEqual({ total: 4, booked: 2, waiting: 1, successRate: 0.5 });
  });
});
