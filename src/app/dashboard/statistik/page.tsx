import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { computeStats } from "@/lib/stats";

const RANGES = { "30": "30 Tage", "90": "90 Tage", "365": "12 Monate" } as const;
const pct = (n: number) => `${Math.round(n * 100)} %`;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ tage?: string }> }) {
  const { org, user } = await requireMember();
  const { tage = "30" } = await searchParams;
  const days = tage in RANGES ? Number(tage) : 30;
  const since = new Date(Date.now() - days * 86400_000);

  const [bookings, negotiations, eventTypes, members] = await Promise.all([
    db.booking.findMany({
      where: { organizationId: org.id, createdAt: { gte: since } },
      select: { id: true, status: true, startTime: true, eventTypeId: true, hostId: true, rescheduledFromId: true },
    }),
    db.negotiation.findMany({ where: { organizationId: org.id, createdAt: { gte: since } }, select: { status: true } }),
    db.eventType.findMany({ where: { organizationId: org.id }, select: { id: true, title: true } }),
    db.user.findMany({ where: { memberships: { some: { organizationId: org.id } } }, select: { id: true, name: true, email: true } }),
  ]);
  const s = computeStats(bookings, negotiations, user.timeZone);
  const etName = (id: string) => eventTypes.find((e) => e.id === id)?.title ?? "Gelöschter Meeting-Typ";
  const hostName = (id: string) => {
    const m = members.find((u) => u.id === id);
    return m?.name ?? m?.email ?? "Ehemaliges Mitglied";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Statistik</h1>
        <div className="flex gap-2 text-sm">
          {Object.entries(RANGES).map(([k, label]) => (
            <Link
              key={k}
              href={`/dashboard/statistik?tage=${k}`}
              className={`rounded-lg px-3 py-1.5 ${String(days) === k ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-sm text-slate-500">Buchungen, die in diesem Zeitraum eingegangen sind.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Gebucht" value={s.booked} />
        <Tile label="Abgesagt" value={s.cancelled} hint={`${pct(s.cancelRate)} der Buchungen`} />
        <Tile label="Verschoben" value={s.rescheduled} />
        <Tile
          label="KI-Verhandlungen"
          value={s.negotiations.total}
          hint={s.negotiations.total ? `${pct(s.negotiations.successRate)} gebucht · ${s.negotiations.waiting} warten` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bars title="Nach Meeting-Typ" rows={s.byEventType.map(([id, v]) => ({ label: etName(id), value: v }))} color={org.brandColor} />
        <Bars title="Nach Gastgeber" rows={s.byHost.map(([id, v]) => ({ label: hostName(id), value: v }))} color={org.brandColor} />
        <Bars title="Nach Wochentag" rows={s.byWeekday} color={org.brandColor} />
        <Bars title="Nach Uhrzeit" rows={s.byHour} color={org.brandColor} />
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Bars({ title, rows, color }: { title: string; rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {rows.every((r) => r.value === 0) ? (
        <p className="text-sm text-slate-400">Noch keine Daten.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="truncate text-slate-600">{r.label}</span>
              <span className="h-2.5 rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
              </span>
              <span className="text-right tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
