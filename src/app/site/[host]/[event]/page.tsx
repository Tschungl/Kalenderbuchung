import { notFound } from "next/navigation";
import { BrandedPage } from "@/components/BrandedPage";
import { EventBookingView } from "@/components/EventBookingView";
import { orgByDomain } from "@/lib/domains";
import { loadEventType } from "@/lib/slots";

export default async function DomainEventPage({ params }: { params: Promise<{ host: string; event: string }> }) {
  const { host, event } = await params;
  const org = await orgByDomain(host);
  if (!org) notFound();
  const et = await loadEventType(org.slug, event);
  if (!et) notFound();
  return (
    <BrandedPage org={et.organization}>
      <EventBookingView et={et} homeHref="/" />
    </BrandedPage>
  );
}
