import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";
import { canManage, requireMember } from "@/lib/session";
import { cancelBookingFromDashboard } from "../actions";

type Search = { host?: string; zeit?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { org, user, membership } = await requireMember();
  const { host, zeit = "kommend" } = await searchParams;
  const past = zeit === "vergangen";
  const now = new Date();

  const where: Prisma.BookingWhereInput = {
    organizationId: org.id,
    ...(past ? { endTime: { lt: now } } : { endTime: { gte: now } }),
    ...(host ? { hostId: host } : {}),
  };
  const [bookings, hosts, upcomingCount] = await Promise.all([
    db.booking.findMany({
      where,
      include: { attendees: true, eventType: true, host: true },
      orderBy: { startTime: past ? "desc" : "asc" },
      take: 200,
    }),
    db.user.findMany({ where: { memberships: { some: { organizationId: org.id } } }, orderBy: { name: "asc" } }),
    db.booking.count({ where: { organizationId: org.id, status: "CONFIRMED", startTime: { gte: now } } }),
  ]);

  const link = (p: Search) => {
    const q = new URLSearchParams({ ...(host ? { host } : {}), zeit, ...p } as Record<string, string>);
    if (!q.get("host")) q.delete("host");
    return `/dashboard/bookings?${q}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Buchungen</h1>
        <p className="text-sm text-slate-500">{upcomingCount} kommende Termine im Team</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={link({ zeit: "kommend" })} className={!past ? "btn" : "btn-secondary"}>Kommend</Link>
        <Link href={link({ zeit: "vergangen" })} className={past ? "btn" : "btn-secondary"}>Vergangen</Link>
        <span className="mx-2 text-slate-300">|</span>
        <Link href={link({ host: "" })} className={!host ? "font-semibold" : "text-slate-600 hover:underline"}>
          Alle Gastgeber
        </Link>
        {hosts.map((h) => (
          <Link
            key={h.id}
            href={link({ host: h.id })}
            className={host === h.id ? "font-semibold" : "text-slate-600 hover:underline"}
          >
            {h.name ?? h.email}
          </Link>
        ))}
      </div>
      <div className="card divide-y divide-slate-100 p-0">
        {bookings.map((b) => {
          const mayCancel = b.hostId === user.id || canManage(membership.role);
          const guests = b.attendees.filter((a) => a.isGuest).length;
          return (
            <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="font-medium">
                  {b.eventType.title} mit {b.attendees.filter((a) => !a.isGuest).map((a) => a.name).join(", ")}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDateTime(b.startTime, user.timeZone)} · Gastgeber: {b.host.name ?? b.host.email}
                  {guests > 0 && ` · +${guests} Gäste`}
                </p>
              </div>
              {b.status === "CANCELLED" ? (
                <span className="text-sm text-red-600">abgesagt</span>
              ) : (
                !past &&
                mayCancel && (
                  <form action={cancelBookingFromDashboard.bind(null, b.id)}>
                    <button className="btn-secondary">Absagen</button>
                  </form>
                )
              )}
            </div>
          );
        })}
        {bookings.length === 0 && <p className="px-6 py-4 text-slate-500">Keine Buchungen.</p>}
      </div>
    </div>
  );
}
