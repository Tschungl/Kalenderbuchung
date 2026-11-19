import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";
import { requireMember } from "@/lib/session";
import { cancelBookingFromDashboard } from "../actions";

export default async function BookingsPage() {
  const { org, user } = await requireMember();
  const bookings = await db.booking.findMany({
    where: { organizationId: org.id, endTime: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
    include: { attendees: true, eventType: true, host: true },
    orderBy: { startTime: "asc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Buchungen</h1>
      <div className="card divide-y divide-slate-100 p-0">
        {bookings.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="font-medium">
                {b.eventType.title} mit {b.attendees.filter((a) => !a.isGuest).map((a) => a.name).join(", ")}
              </p>
              <p className="text-sm text-slate-500">
                {formatDateTime(b.startTime, user.timeZone)} · Gastgeber: {b.host.name ?? b.host.email}
                {b.attendees.some((a) => a.isGuest) && ` · +${b.attendees.filter((a) => a.isGuest).length} Gäste`}
              </p>
            </div>
            {b.status === "CANCELLED" ? (
              <span className="text-sm text-red-600">abgesagt</span>
            ) : (
              <form action={cancelBookingFromDashboard.bind(null, b.id)}>
                <button className="btn-secondary">Absagen</button>
              </form>
            )}
          </div>
        ))}
        {bookings.length === 0 && <p className="px-6 py-4 text-slate-500">Noch keine Buchungen.</p>}
      </div>
    </div>
  );
}
