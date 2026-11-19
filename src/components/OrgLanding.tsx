import Link from "next/link";
import { BrandedPage } from "@/components/BrandedPage";
import type { Branding } from "@/lib/branding";

type Org = Branding & {
  name: string;
  slug: string;
  eventTypes: { id: string; slug: string; title: string; durationMin: number; description: string | null }[];
};

/** Startseite einer Organisation mit allen buchbaren Meeting-Typen. basePath "" bei eigener Domain. */
export function OrgLanding({ org, basePath }: { org: Org; basePath: string }) {
  return (
    <BrandedPage org={org}>
      <div className="mx-auto max-w-2xl py-6">
        <div className="mb-6 flex items-center gap-4">
          {org.logoUrl && <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />}
          <span className="text-lg font-semibold">{org.name}</span>
        </div>
        <h1 className="text-3xl font-semibold">{org.welcomeTitle || `Termin mit ${org.name} buchen`}</h1>
        {org.welcomeText && <p className="mt-3 whitespace-pre-line opacity-80">{org.welcomeText}</p>}
        <div className="mt-8 space-y-3">
          {org.eventTypes.map((et) => (
            <Link
              key={et.id}
              href={`${basePath}/${et.slug}`}
              className="card block border-l-4 transition hover:shadow-md"
              style={{ borderLeftColor: org.brandColor }}
            >
              <h2 className="font-semibold">{et.title}</h2>
              <p className="text-sm text-slate-500">{et.durationMin} Minuten</p>
              {et.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{et.description}</p>}
            </Link>
          ))}
          {org.eventTypes.length === 0 && <p className="text-sm text-slate-500">Zurzeit sind keine Termine buchbar.</p>}
        </div>
      </div>
    </BrandedPage>
  );
}
