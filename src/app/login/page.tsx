import { SignInButtons } from "@/components/SignInButtons";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <div className="card space-y-4">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="text-sm text-slate-600">
          Wir fragen Zugriff auf deinen Kalender an, um freie Zeiten zu berechnen und gebuchte Termine einzutragen.
        </p>
        <SignInButtons redirectTo="/dashboard" />
      </div>
    </main>
  );
}
