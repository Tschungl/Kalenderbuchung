/**
 * Regeln für die KI-Verhandlung. Sie legen fest, wie weit der Agent über die
 * normalen Buchungszeiten hinausgehen darf. Alles, was der Agent anbietet oder
 * bucht, wird serverseitig gegen diese Regeln geprüft.
 */
import { z } from "zod";
import type { Slot, WeeklyHours } from "@/lib/availability";

const time = z.string().regex(/^\d{2}:\d{2}$/);

export const NegotiationRulesSchema = z.object({
  enabled: z.boolean().default(false),
  /** Erweiterte Tageszeiten (Mo–Fr), z.B. früher anfangen oder später aufhören */
  extendedStart: time.default("08:00"),
  extendedEnd: time.default("19:00"),
  /** Wochenenden in denselben erweiterten Zeiten erlauben (immer mit Freigabe) */
  allowWeekends: z.boolean().default(false),
  /** Kürzere Vorlaufzeit als regulär, in Minuten */
  minNoticeMin: z.number().int().min(0).default(120),
  /** Erweiterte Werktagszeiten ohne Rückfrage buchen? Sonst Freigabe per Mail. */
  autoBookExtended: z.boolean().default(false),
  /** Maximale Anzahl Kundennachrichten pro Verhandlung */
  maxTurns: z.number().int().min(1).max(50).default(12),
  /** Zusätzliche Hinweise für den Agenten (Ton, Besonderheiten) */
  instructions: z.string().max(2000).default(""),
});

export type NegotiationRules = z.infer<typeof NegotiationRulesSchema>;

export const DEFAULT_RULES: NegotiationRules = NegotiationRulesSchema.parse({});

export function parseRules(value: unknown): NegotiationRules {
  const parsed = NegotiationRulesSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_RULES;
}

const WEEKDAYS = ["1", "2", "3", "4", "5"] as const;
const WEEKEND = ["6", "7"] as const;

/** Erweitert die Wochenzeiten eines Gastgebers um die erlaubten Verhandlungszeiten. */
export function extendWeekly(weekly: WeeklyHours, rules: NegotiationRules): WeeklyHours {
  const result: WeeklyHours = { ...weekly };
  const days = rules.allowWeekends ? [...WEEKDAYS, ...WEEKEND] : [...WEEKDAYS];
  for (const d of days) {
    const ranges = weekly[d] ?? [];
    if (ranges.length === 0) {
      result[d] = [{ start: rules.extendedStart, end: rules.extendedEnd }];
      continue;
    }
    const start = ranges.reduce((m, r) => (r.start < m ? r.start : m), rules.extendedStart);
    const end = ranges.reduce((m, r) => (r.end > m ? r.end : m), rules.extendedEnd);
    result[d] = [{ start, end }];
  }
  return result;
}

export type SlotKind = "regular" | "auto" | "approval";
export type ClassifiedSlot = { start: string; end: string; kind: SlotKind };

function isWeekend(date: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return day === "Sat" || day === "Sun";
}

/**
 * Ordnet erweiterte Slots ein:
 * - regular: auch regulär buchbar
 * - auto: Ausnahmezeit, die ohne Rückfrage gebucht werden darf
 * - approval: Ausnahmezeit, die der Gastgeber freigeben muss
 */
export function classifySlots(
  regular: Slot[],
  extended: Slot[],
  rules: NegotiationRules,
  timeZone: string,
): ClassifiedSlot[] {
  const regularStarts = new Set(regular.map((s) => s.start.getTime()));
  return extended.map((s) => {
    let kind: SlotKind = "approval";
    if (regularStarts.has(s.start.getTime())) kind = "regular";
    else if (rules.autoBookExtended && !isWeekend(s.start, timeZone)) kind = "auto";
    return { start: s.start.toISOString(), end: s.end.toISOString(), kind };
  });
}
