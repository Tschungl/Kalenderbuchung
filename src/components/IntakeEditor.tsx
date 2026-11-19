"use client";

import { useState } from "react";

type Q = { id: string; text: string; kind: "text" | "participant"; required: boolean };

/** Fragen-Editor für die KI-Vorabfragen; schreibt die Liste als JSON in ein verstecktes Feld. */
export function IntakeEditor({ initial }: { initial: Q[] }) {
  const [questions, setQuestions] = useState<Q[]>(initial);
  const update = (i: number, patch: Partial<Q>) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const nextId = () => {
    const used = new Set(questions.map((q) => q.id));
    let n = questions.length + 1;
    while (used.has(`q${n}`)) n++;
    return `q${n}`;
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="intake_questions" value={JSON.stringify(questions.filter((q) => q.text.trim()))} />
      {questions.map((q, i) => (
        <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 sm:flex-nowrap">
          <input
            className="input min-w-0"
            style={{ flex: "1 1 16rem" }}
            aria-label={`Frage ${i + 1}`}
            placeholder="z.B. Wer aus der IT nimmt teil?"
            maxLength={300}
            value={q.text}
            onChange={(e) => update(i, { text: e.target.value })}
          />
          <select
            className="input"
            style={{ width: "auto", flex: "0 0 auto" }}
            aria-label={`Art der Frage ${i + 1}`}
            value={q.kind}
            onChange={(e) => update(i, { kind: e.target.value as Q["kind"] })}
          >
            <option value="text">Antwort</option>
            <option value="participant">Person einladen</option>
          </select>
          <label className="flex items-center gap-1 text-sm whitespace-nowrap">
            <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} /> Pflicht
          </label>
          <button
            type="button"
            className="px-2 text-slate-400 hover:text-red-600"
            aria-label={`Frage ${i + 1} entfernen`}
            onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      {questions.length < 10 && (
        <button
          type="button"
          className="text-sm font-medium text-blue-700 hover:underline"
          onClick={() => setQuestions([...questions, { id: nextId(), text: "", kind: "text", required: true }])}
        >
          + Frage hinzufügen
        </button>
      )}
      <p className="text-xs text-slate-500">
        „Person einladen“: Der Assistent fragt nach Name und E-Mail. Die Person bekommt die Kalendereinladung. Bei „Pflicht“
        kann erst gebucht werden, wenn die Frage geklärt ist.
      </p>
    </div>
  );
}
