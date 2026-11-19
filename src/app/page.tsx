import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-24">
      <h1 className="text-4xl font-bold">Termine buchen, ohne Hin und Her</h1>
      <p className="text-lg text-slate-600">
        Verbinde deinen Google Kalender, lege Meeting-Typen an und teile deine Buchungsseite.
        Kunden sehen nur Zeiten, an denen du wirklich frei bist.
      </p>
      <Link href={session ? "/dashboard" : "/login"} className="btn">
        {session ? "Zum Dashboard" : "Mit Google anmelden"}
      </Link>
    </main>
  );
}
