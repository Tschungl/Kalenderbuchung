import Link from "next/link";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";
import { switchOrganization } from "./team/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await requireMember();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <nav className="flex flex-wrap items-center gap-5 text-sm">
            {memberships.length > 1 ? (
              <details className="relative">
                <summary className="cursor-pointer font-semibold">{org.name} ▾</summary>
                <div className="absolute z-10 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow">
                  {memberships.map((m) => (
                    <form key={m.id} action={switchOrganization.bind(null, m.organizationId)}>
                      <button
                        className={`w-full rounded px-3 py-2 text-left hover:bg-slate-100 ${m.organizationId === org.id ? "font-semibold" : ""}`}
                      >
                        {m.organization.name}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            ) : (
              <span className="font-semibold">{org.name}</span>
            )}
            <Link href="/dashboard" className="hover:text-blue-600">Meeting-Typen</Link>
            <Link href="/dashboard/availability" className="hover:text-blue-600">Verfügbarkeit</Link>
            <Link href="/dashboard/bookings" className="hover:text-blue-600">Buchungen</Link>
            <Link href="/dashboard/verhandlungen" className="hover:text-blue-600">Verhandlungen</Link>
            <Link href="/dashboard/team" className="hover:text-blue-600">Team</Link>
            <Link href="/dashboard/settings" className="hover:text-blue-600">Einstellungen</Link>
            <Link href={`/${org.slug}`} className="hover:text-blue-600" target="_blank">Buchungsseite ↗</Link>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="flex items-center gap-3 text-sm text-slate-500"
          >
            {user.email}
            <button className="btn-secondary">Abmelden</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
