import { notFound } from "next/navigation";
import { OrgLanding } from "@/components/OrgLanding";
import { orgByDomain } from "@/lib/domains";

/** Startseite unter eigener Domain (Umschreibung durch src/middleware.ts). */
export default async function DomainHome({ params }: { params: Promise<{ host: string }> }) {
  const org = await orgByDomain((await params).host);
  if (!org) notFound();
  return <OrgLanding org={org} basePath="" />;
}
