import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createOrganization } from "../dashboard/team/actions";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <form action={createOrganization} className="card space-y-4">
        <h1 className="text-2xl font-semibold">Organisation anlegen</h1>
        <p className="text-sm text-slate-600">
          Du bist aktuell in keiner Organisation. Lege eine eigene an oder nimm eine Einladung per E-Mail an.
        </p>
        <input className="input" name="name" placeholder="Name deiner Firma oder deines Teams" required />
        <button className="btn w-full">Anlegen</button>
      </form>
    </main>
  );
}
