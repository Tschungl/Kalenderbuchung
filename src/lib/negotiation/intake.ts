/**
 * KI-Vorabfragen: Der Gastgeber legt pro Meeting-Typ fest, was der Assistent vor
 * der Buchung abfragt. Ist das aktiv, läuft jede Buchung über den Chat, und
 * gebucht werden kann erst, wenn alle Pflichtfragen beantwortet sind. Das prüft
 * der Server, nicht das Modell.
 */
import { z } from "zod";

export const IntakeQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  /** Was der Assistent herausfinden soll, z.B. "Wer aus der IT nimmt teil?" */
  text: z.string().trim().min(1).max(300),
  /** text: Antwort genügt; participant: mindestens eine Person mit E-Mail, die mit eingeladen wird */
  kind: z.enum(["text", "participant"]).default("text"),
  required: z.boolean().default(true),
});

export const IntakeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /** Kurzer Einleitungstext über dem Chat */
  intro: z.string().max(500).default(""),
  questions: z.array(IntakeQuestionSchema).max(10).default([]),
});

export type IntakeQuestion = z.infer<typeof IntakeQuestionSchema>;
export type IntakeConfig = z.infer<typeof IntakeConfigSchema>;
export type IntakeAnswer = { questionId: string; question: string; answer: string };
export type Participant = { name?: string; email: string; questionId?: string };

export const DEFAULT_INTAKE: IntakeConfig = IntakeConfigSchema.parse({});

export function parseIntake(value: unknown): IntakeConfig {
  const parsed = IntakeConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_INTAKE;
}

/** Aktiv heißt: eingeschaltet und mindestens eine Frage hinterlegt. */
export function intakeActive(config: IntakeConfig) {
  return config.enabled && config.questions.length > 0;
}

/** Welche Pflichtfragen fehlen noch? */
export function missingIntake(config: IntakeConfig, answers: IntakeAnswer[], participants: Participant[]): IntakeQuestion[] {
  return config.questions.filter((q) => {
    if (!q.required) return false;
    if (q.kind === "participant") return !participants.some((p) => p.questionId === q.id);
    return !answers.some((a) => a.questionId === q.id && a.answer.trim());
  });
}

/** Zusammenfassung für Kalender-Event, Mails und Dashboard */
export function intakeSummary(answers: IntakeAnswer[], participants: Participant[], config: IntakeConfig): string {
  const lines: string[] = [];
  for (const q of config.questions) {
    const a = answers.find((x) => x.questionId === q.id)?.answer;
    const ps = participants.filter((p) => p.questionId === q.id).map((p) => (p.name ? `${p.name} <${p.email}>` : p.email));
    const value = [a, ps.length ? ps.join(", ") : ""].filter(Boolean).join(" · ");
    if (value) lines.push(`- ${q.text}: ${value}`);
  }
  return lines.length ? `Vorabfragen:\n${lines.join("\n")}` : "";
}
