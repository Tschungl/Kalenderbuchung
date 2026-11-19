import { notFound } from "next/navigation";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { eventType: { include: { organization: true } }, attendees: true, host: true },
  });
  if (!booking) notFound();
  const tz = booking.attendees.find((a) => !a.isGuest)?.timeZone ?? "Europe/Berlin";
  const isPast = booking.startTime < new Date();
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="card space-y-3">
        <p className="text-sm text-slate-500">{booking.eventType.organization.name}</p>
        <h1 className="text-2xl font-semibold">{booking.eventType.title}</h1>
        <p>{formatDateTime(booking.startTime, tz)}</p>
        <p className="text-sm text-slate-600">mit {booking.host.name ?? booking.host.email}</p>
        {booking.meetingUrl && booking.status === "CONFIRMED" && (
          <a href={booking.meetingUrl} className="text-sm text-blue-600 underline">{booking.meetingUrl}</a>
        )}
        {booking.status === "CANCELLED" ? (
          <p className="font-medium text-red-600">Dieser Termin wurde abgesagt.</p>
        ) : (
          !isPast && <CancelBookingButton token={token} />
        )}
      </div>
    </main>
  );
}
