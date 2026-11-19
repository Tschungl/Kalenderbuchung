"use client";

import { useEffect, useMemo, useState } from "react";
import { NegotiationChat } from "./NegotiationChat";

type Slot = { start: string; end: string };
type Props = {
  org: string;
  event: string;
  durationMin: number;
  maxGuests: number;
  brandColor: string;
  negotiationEnabled?: boolean;
};

const DAY_MS = 24 * 3600_000;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() + 6) % 7; // Montag = 0
  x.setDate(x.getDate() - diff);
  return x;
}

export function BookingWidget({ org, event, durationMin, maxGuests, brandColor, negotiationEnabled }: Props) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [done, setDone] = useState<{ meetingUrl: string | null; start: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [negotiating, setNegotiating] = useState(false);

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
    return <NegotiationChat mode="new" org={org} event={event} brandColor={brandColor} onBack={() => setNegotiating(false)} />;
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">✅ Termin bestätigt</h2>
        <p>{longFmt.format(new Date(done.start))}</p>
        <p className="text-sm text-slate-600">Eine Kalendereinladung ist unterwegs.</p>
        {done.meetingUrl && <a href={done.meetingUrl} className="text-sm text-blue-600 underline">{done.meetingUrl}</a>}
      </div>
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
              guests: String(f.get("guests") ?? "").split(/[,;\s]+/).filter(Boolean),
              timeZone,
            }),
          });
          const data = await res.json().catch(() => ({}));
          setSubmitting(false);
          if (res.ok) setDone({ meetingUrl: data.meetingUrl, start: selected.start });
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
          <div>
            <label className="label" htmlFor="guests">Weitere Teilnehmer (E-Mails, bis zu {maxGuests})</label>
            <input className="input" id="guests" name="guests" placeholder="anna@firma.de, ben@firma.de" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="notes">Worum geht es? (optional)</label>
          <textarea className="input" id="notes" name="notes" rows={3} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn" disabled={submitting} style={{ backgroundColor: brandColor }}>
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
      <p className="text-xs text-slate-500">Zeiten in deiner Zeitzone: {timeZone}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!slots && !error && <p className="text-sm text-slate-500">Lade freie Zeiten…</p>}
      {slots && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => (
            <div key={day.toISOString()} className="space-y-2">
              <p className="text-center text-sm font-medium">{dayFmt.format(day)}</p>
              {byDay(day).map((s) => (
                <button
                  key={s.start}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm hover:text-white"
                  style={{ borderColor: brandColor, color: brandColor }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = brandColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                  onClick={() => setSelected(s)}
                >
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
      {negotiationEnabled && slots && (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm">
          <span className="text-slate-600">Keine passende Zeit dabei? </span>
          <button type="button" className="font-medium underline" style={{ color: brandColor }} onClick={() => setNegotiating(true)}>
            Sag uns, wann es dir passt
          </button>
        </div>
      )}
    </div>
  );
}
