import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { OrgLanding } from "@/components/OrgLanding";

export default async function OrgPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    include: { eventTypes: { where: { active: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!org) notFound();
  return <OrgLanding org={org} basePath={`/${org.slug}`} />;
}
