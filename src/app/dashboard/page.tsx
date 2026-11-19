import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";

const MODE_LABEL = { SINGLE: "Einzeln", COLLECTIVE: "Kollektiv", ROUND_ROBIN: "Round Robin" } as const;

export default async function EventTypesPage() {
  const { org } = await requireMember();
  const eventTypes = await db.eventType.findMany({
    where: { organizationId: org.id },
    include: { hosts: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meeting-Typen</h1>
        <Link href="/dashboard/event-types/new" className="btn">Neuer Meeting-Typ</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {eventTypes.map((et) => (
          <div key={et.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">{et.title}</h2>
              {!et.active && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">inaktiv</span>}
            </div>
            <p className="text-sm text-slate-500">
              {et.durationMin} Min. · {MODE_LABEL[et.mode]} · {et.hosts.map((h) => h.user.name ?? h.user.email).join(", ")}
            </p>
            <p className="truncate text-xs text-slate-400">/{org.slug}/{et.slug}</p>
            <div className="flex gap-2 pt-2">
              <Link href={`/dashboard/event-types/${et.id}`} className="btn-secondary">Bearbeiten</Link>
              <Link href={`/${org.slug}/${et.slug}`} target="_blank" className="btn-secondary">Ansehen ↗</Link>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && <p className="text-slate-500">Noch keine Meeting-Typen angelegt.</p>}
      </div>
    </div>
  );
}
