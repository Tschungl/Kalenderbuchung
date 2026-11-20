"use client";

import { useEffect, useMemo, useState } from "react";
import { NegotiationChat } from "./NegotiationChat";
import { t, type Anrede } from "@/lib/salutation";

type Slot = { start: string; end: string };
type Props = {
  org: string;
  event: string;
  durationMin: number;
  maxGuests: number;
  brandColor: string;
  negotiationEnabled?: boolean;
  confirmationText?: string | null;
  embed?: boolean;
  /** KI-Vorabfragen: Buchung läuft über den Assistenten */
  intake?: { intro: string };
  /** Anrede der Kunden (Organisationseinstellung) */
  anrede?: Anrede;
  /** Verwaltungs-Token einer bestehenden Buchung: dann wird verschoben statt neu gebucht */
  rescheduleToken?: string;
};

const DAY_MS = 24 * 3600_000;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() + 6) % 7; // Montag = 0
  x.setDate(x.getDate() - diff);
  return x;
}

export function BookingWidget({ org, event, durationMin, maxGuests, brandColor, negotiationEnabled, confirmationText, embed, rescheduleToken, intake, anrede }: Props) {
  const tx = t(anrede);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [done, setDone] = useState<{ meetingUrl: string | null; start: string; manageToken?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [negotiating, setNegotiating] = useState(false);
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([]);

  useEffect(() => {
    const from = weekStart;
    const to = new Date(weekStart.getTime() + 7 * DAY_MS);
    setSlots(null);
    setError(null);
    fetch(`/api/slots?org=${encodeURIComponent(org)}&event=${encodeURIComponent(event)}&from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json()).error)))
      .then((d) => setSlots(d.slots))
      .catch((e) => setError(typeof e === "string" ? e : "Zeiten konnten nicht geladen werden"));
  }, [org, event, weekStart]);

  const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
  const longFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });

  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const byDay = (day: Date) =>
    (slots ?? []).filter((s) => new Date(s.start).toDateString() === day.toDateString());

  if (negotiating) {
    return <NegotiationChat mode="new" org={org} event={event} brandColor={brandColor} anrede={anrede} onBack={() => setNegotiating(false)} />;
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">✅ Termin {rescheduleToken ? "verschoben" : "bestätigt"}</h2>
        <p>{longFmt.format(new Date(done.start))}</p>
        <p className="text-sm text-slate-600">
          {guests.some((g) => g.email.trim())
            ? tx.invitedAlso(guests.filter((g) => g.email.trim()).map((g) => g.name.trim() || g.email.trim()).join(", "))
            : "Eine Kalendereinladung ist unterwegs."}
        </p>
        {confirmationText && <p className="whitespace-pre-line text-sm">{confirmationText}</p>}
        {done.meetingUrl && <a href={done.meetingUrl} className="text-sm text-blue-600 underline">{done.meetingUrl}</a>}
        {rescheduleToken && done.manageToken && (
          <p className="text-sm">
            <a href={`/booking/${done.manageToken}`} className="underline">Zur neuen Buchung</a>
          </p>
        )}
      </div>
    );
  }

  if (selected && rescheduleToken) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => setSelected(null)}>
          ← andere Zeit wählen
        </button>
        <p className="font-medium">Neue Zeit: {longFmt.format(new Date(selected.start))} ({durationMin} Min.)</p>
        <p className="text-sm text-slate-600">Der bisherige Termin wird danach automatisch abgesagt.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="brand-btn px-4 py-2 text-sm"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const res = await fetch(`/api/bookings/${rescheduleToken}/reschedule`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ start: selected.start }),
            });
            const data = await res.json().catch(() => ({}));
            setSubmitting(false);
            if (res.ok) setDone({ meetingUrl: data.meetingUrl, start: selected.start, manageToken: data.manageToken });
            else setError(data.error ?? "Verschieben fehlgeschlagen");
          }}
        >
          {submitting ? "Wird verschoben…" : "Termin verschieben"}
        </button>
      </div>
    );
  }

  if (selected && intake) {
    return (
      <NegotiationChat
        key={selected.start}
        mode="intake"
        org={org}
        event={event}
        brandColor={brandColor}
        start={selected.start}
        startLabel={`${longFmt.format(new Date(selected.start))} (${durationMin} Min.)`}
        intro={intake.intro}
        anrede={anrede}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (selected) {
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setSubmitting(true);
          setError(null);
          const res = await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              org,
              event,
              start: selected.start,
              name: f.get("name"),
              email: f.get("email"),
              notes: f.get("notes") || undefined,
              guests: guests
                .filter((g) => g.email.trim())
                .map((g) => ({ email: g.email.trim(), name: g.name.trim() || undefined })),
              timeZone,
            }),
          });
          const data = await res.json().catch(() => ({}));
          setSubmitting(false);
          if (res.ok) {
            setDone({ meetingUrl: data.meetingUrl, start: selected.start });
            // Einbettende Seite informieren (z.B. für Tracking oder Weiterleitung)
            if (embed && window.parent !== window) {
              window.parent.postMessage({ type: "kalender:booked", start: selected.start, event }, "*");
            }
          }
          else setError(data.error ?? "Buchung fehlgeschlagen");
        }}
      >
        <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => setSelected(null)}>
          ← andere Zeit wählen
        </button>
        <p className="font-medium">
          {longFmt.format(new Date(selected.start))} ({durationMin} Min.)
        </p>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        {maxGuests > 0 && (
          <div className="space-y-2">
            {guests.length > 0 && <p className="label">Kollegen einladen</p>}
            {guests.map((g, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  aria-label={`Name Kollege ${i + 1}`}
                  placeholder="Name (optional)"
                  value={g.name}
                  onChange={(e) => setGuests(guests.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="input flex-1"
                  type="email"
                  required
                  aria-label={`E-Mail Kollege ${i + 1}`}
                  placeholder="E-Mail"
                  value={g.email}
                  onChange={(e) => setGuests(guests.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className="px-2 text-slate-400 hover:text-red-600"
                  aria-label={`Kollege ${i + 1} entfernen`}
                  onClick={() => setGuests(guests.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            {guests.length < maxGuests && (
              <button
                type="button"
                className="text-sm font-medium hover:underline"
                style={{ color: brandColor }}
                onClick={() => setGuests([...guests, { name: "", email: "" }])}
              >
                + {guests.length ? "Weitere Person" : "Kollegen einladen"}
              </button>
            )}
            {guests.length > 0 && (
              <p className="text-xs text-slate-500">Eingeladene Personen bekommen eine Kalendereinladung und eine E-Mail mit allen Infos.</p>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="notes">Worum geht es? (optional)</label>
          <textarea className="input" id="notes" name="notes" rows={3} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="brand-btn px-4 py-2 text-sm" disabled={submitting}>
          {submitting ? "Wird gebucht…" : "Termin buchen"}
        </button>
      </form>
    );
  }

  const isCurrentWeek = weekStart.getTime() <= startOfWeek(new Date()).getTime();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Zeit auswählen</h2>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            disabled={isCurrentWeek}
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
          >
            ←
          </button>
          <button className="btn-secondary" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}>
            →
          </button>
        </div>
      </div>
      {/* Zeitzone kommt aus dem Browser und weicht beim Server-Rendern ab */}
      <p className="text-xs text-slate-500" suppressHydrationWarning>{tx.yourTimeZone}: {timeZone}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!slots && !error && <p className="text-sm text-slate-500">Lade freie Zeiten…</p>}
      {slots && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => (
            <div key={day.toISOString()} className="space-y-2">
              <p className="text-center text-sm font-medium">{dayFmt.format(day)}</p>
              {byDay(day).map((s) => (
                <button key={s.start} className="slot-btn w-full px-2 py-1.5 text-sm" onClick={() => setSelected(s)}>
                  {timeFmt.format(new Date(s.start))}
                </button>
              ))}
              {byDay(day).length === 0 && <p className="text-center text-xs text-slate-300">–</p>}
            </div>
          ))}
        </div>
      )}
      {slots && slots.length === 0 && (
        <p className="text-sm text-slate-500">In dieser Woche ist nichts frei. Schau in der nächsten Woche nach.</p>
      )}
      {negotiationEnabled && slots && !rescheduleToken && (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm">
          <span className="text-slate-600">Keine passende Zeit dabei? </span>
          <button type="button" className="font-medium underline" style={{ color: brandColor }} onClick={() => setNegotiating(true)}>
            {tx.tellUsWhen}
          </button>
        </div>
      )}
    </div>
  );
}
