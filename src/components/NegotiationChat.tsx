"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Entry = {
  role: "customer" | "assistant" | "system";
  text: string;
  at: string;
  proposals?: { start: string; label: string }[];
};
type Status = "OPEN" | "AWAITING_APPROVAL" | "BOOKED" | "DECLINED" | "CLOSED";

type Props =
  | { mode: "new"; org: string; event: string; brandColor: string; onBack?: () => void }
  | { mode: "resume"; token: string; brandColor: string; initialTranscript: Entry[]; initialStatus: Status };

export function NegotiationChat(props: Props) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [token, setToken] = useState<string | null>(props.mode === "resume" ? props.token : null);
  const [transcript, setTranscript] = useState<Entry[]>(props.mode === "resume" ? props.initialTranscript : []);
  const [status, setStatus] = useState<Status>(props.mode === "resume" ? props.initialStatus : "OPEN");
  const [contact, setContact] = useState({ name: "", email: "" });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [transcript, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setTranscript((t) => [...t, { role: "customer", text, at: new Date().toISOString() }]);
    setInput("");
    try {
      const res = token
        ? await fetch(`/api/negotiations/${token}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text }),
          })
        : await fetch("/api/negotiations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              org: props.mode === "new" ? props.org : "",
              event: props.mode === "new" ? props.event : "",
              name: contact.name,
              email: contact.email,
              timeZone,
              message: text,
            }),
          });
      const data = await res.json().catch(() => ({}));
      if (data.token) setToken(data.token);
      if (!res.ok) {
        setError(data.error ?? "Das hat nicht geklappt.");
        return;
      }
      setTranscript(data.transcript);
      setStatus(data.status);
    } finally {
      setBusy(false);
    }
  }

  const needsContact = !token && (!contact.name || !/.+@.+\..+/.test(contact.email));
  const closed = status === "BOOKED" || status === "CLOSED" || status === "AWAITING_APPROVAL";
  const lastAssistant = [...transcript].reverse().find((e) => e.role === "assistant");

  return (
    <div className="flex h-full flex-col gap-4">
      {props.mode === "new" && props.onBack && (
        <button type="button" className="self-start text-sm text-slate-500 hover:underline" onClick={props.onBack}>
          ← zurück zu den Zeiten
        </button>
      )}
      <div>
        <h2 className="font-semibold">Keine passende Zeit dabei?</h2>
        <p className="text-sm text-slate-600">
          Schreib kurz, wann es dir passt. Unser Assistent sucht Alternativen und fragt bei Bedarf beim Gastgeber nach.
        </p>
      </div>

      {!token && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Dein Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
          <input className="input" type="email" placeholder="Deine E-Mail" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
        </div>
      )}

      <div className="max-h-[420px] min-h-[160px] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {transcript.length === 0 && (
          <p className="text-sm text-slate-400">z.B. „Nächste Woche nur vormittags, Donnerstag ginge auch abends.“</p>
        )}
        {transcript.map((e, i) =>
          e.role === "system" ? (
            <p key={i} className="text-center text-xs text-slate-500">{e.text}</p>
          ) : (
            <div key={i} className={`flex ${e.role === "customer" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                  e.role === "customer" ? "text-white" : "border border-slate-200 bg-white"
                }`}
                style={e.role === "customer" ? { backgroundColor: props.brandColor } : undefined}
              >
                {e.text}
                {e.proposals && e === lastAssistant && !closed && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {e.proposals.map((p) => (
                      <button
                        key={p.start}
                        type="button"
                        disabled={busy}
                        className="rounded-lg border px-2 py-1 text-xs font-medium"
                        style={{ borderColor: props.brandColor, color: props.brandColor }}
                        onClick={() => send(`Ich nehme ${p.label}.`)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <p className="text-sm text-slate-400">Assistent schreibt…</p>}
        <div ref={endRef} />
      </div>

      {status === "BOOKED" && <p className="text-sm font-medium text-green-700">✅ Termin gebucht. Die Einladung kommt per E-Mail.</p>}
      {status === "AWAITING_APPROVAL" && (
        <p className="text-sm font-medium text-amber-700">⏳ Wir fragen beim Gastgeber nach. Du bekommst eine E-Mail.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!closed && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="input flex-1"
            value={input}
            maxLength={1000}
            disabled={busy || needsContact}
            placeholder={needsContact ? "Bitte zuerst Name und E-Mail eingeben" : "Wann passt es dir?"}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn" disabled={busy || needsContact || !input.trim()} style={{ backgroundColor: props.brandColor }}>
            Senden
          </button>
        </form>
      )}
    </div>
  );
}
