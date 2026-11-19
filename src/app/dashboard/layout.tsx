import Link from "next/link";
import { signOut } from "@/auth";
import { requireMember } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await requireMember();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-6 text-sm">
            <span className="font-semibold">{org.name}</span>
            <Link href="/dashboard" className="hover:text-blue-600">Meeting-Typen</Link>
            <Link href="/dashboard/availability" className="hover:text-blue-600">Verfügbarkeit</Link>
            <Link href="/dashboard/bookings" className="hover:text-blue-600">Buchungen</Link>
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
