import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelBookingButton } from "@/components/CancelBookingButton";
import { BrandedPage, BrandHeader } from "@/components/BrandedPage";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/mail";

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { eventType: { include: { organization: true } }, attendees: true, host: true },
  });
  if (!booking) notFound();
  const org = booking.eventType.organization;
  const tz = booking.attendees.find((a) => !a.isGuest)?.timeZone ?? "Europe/Berlin";
  const isPast = booking.startTime < new Date();
  const replacement =
    booking.status === "CANCELLED"
      ? await db.booking.findFirst({ where: { rescheduledFromId: booking.id }, select: { manageToken: true } })
      : null;
  return (
    <BrandedPage org={org}>
      <div className="mx-auto max-w-lg">
        <BrandHeader org={org} />
        <div className="card space-y-3">
          <h1 className="text-2xl font-semibold">{booking.eventType.title}</h1>
          <p>{formatDateTime(booking.startTime, tz)}</p>
          <p className="text-sm text-slate-600">mit {booking.host.name ?? booking.host.email}</p>
          {booking.meetingUrl && booking.status === "CONFIRMED" && (
            <a href={booking.meetingUrl} className="text-sm underline">{booking.meetingUrl}</a>
          )}
          {booking.status === "CANCELLED" ? (
            replacement ? (
              <p className="font-medium">
                Dieser Termin wurde verschoben. <Link href={`/booking/${replacement.manageToken}`} className="underline">Zum neuen Termin</Link>
              </p>
            ) : (
              <p className="font-medium text-red-600">Dieser Termin wurde abgesagt.</p>
            )
          ) : (
            !isPast && (
              <div className="flex flex-wrap items-start gap-3 pt-2">
                {booking.eventType.active && (
                  <Link href={`/booking/${token}/verschieben`} className="brand-btn px-4 py-2 text-sm">
                    Termin verschieben
                  </Link>
                )}
                <CancelBookingButton token={token} />
              </div>
            )
          )}
        </div>
      </div>
    </BrandedPage>
  );
}
