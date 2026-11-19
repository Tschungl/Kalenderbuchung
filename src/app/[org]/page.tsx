import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function OrgPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    include: { eventTypes: { where: { active: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!org) notFound();
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-center gap-4">
        {org.logoUrl && <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />}
        <h1 className="text-3xl font-semibold">{org.name}</h1>
      </div>
      <div className="space-y-3">
        {org.eventTypes.map((et) => (
          <Link
            key={et.id}
            href={`/${org.slug}/${et.slug}`}
            className="card block border-l-4 transition hover:shadow-md"
            style={{ borderLeftColor: org.brandColor }}
          >
            <h2 className="font-semibold">{et.title}</h2>
            <p className="text-sm text-slate-500">{et.durationMin} Minuten</p>
            {et.description && <p className="mt-2 text-sm text-slate-600">{et.description}</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}
