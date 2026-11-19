import { microsoftEnabled, signIn } from "@/auth";

/** Login-Buttons für Google und (falls eingerichtet) Microsoft 365 / Outlook. */
export function SignInButtons({ redirectTo, suffix = "anmelden" }: { redirectTo: string; suffix?: string }) {
  return (
    <div className="space-y-2">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <button className="btn w-full">Mit Google {suffix}</button>
      </form>
      {microsoftEnabled && (
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo });
          }}
        >
          <button className="btn-secondary w-full">Mit Microsoft 365 / Outlook {suffix}</button>
        </form>
      )}
    </div>
  );
}
