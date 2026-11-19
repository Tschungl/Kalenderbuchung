"use client";

import { useActionState } from "react";
import { createApiKey, type NewKeyState } from "./actions";

export function ApiKeyForm() {
  const [state, action, pending] = useActionState<NewKeyState, FormData>(createApiKey, {});
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="keyName">Neuer Schlüssel</label>
          <input className="input" id="keyName" name="name" placeholder="z.B. CRM-Anbindung" required />
        </div>
        <button className="btn-secondary" disabled={pending}>Erzeugen</button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.key && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium">Jetzt kopieren: Der Schlüssel wird nur dieses eine Mal angezeigt.</p>
          <code className="block break-all rounded bg-white p-2 text-xs">{state.key}</code>
        </div>
      )}
    </div>
  );
}
