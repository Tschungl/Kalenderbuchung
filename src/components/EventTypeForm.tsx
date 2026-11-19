import type { EventType } from "@prisma/client";
import { parseRules } from "@/lib/negotiation/rules";

type Member = { id: string; name: string | null; email: string | null };

const MODES = [
  ["SINGLE", "Ein Gastgeber"],
  ["COLLECTIVE", "Kollektiv: alle Gastgeber müssen frei sein"],
  ["ROUND_ROBIN", "Round Robin: einer aus dem Team, reihum"],
] as const;

const LOCATIONS = [
  ["GOOGLE_MEET", "Google Meet (bei Outlook-Gastgebern Teams)"],
  ["MS_TEAMS", "Microsoft Teams"],
  ["ZOOM", "Zoom"],
  ["PHONE", "Telefon"],
  ["IN_PERSON", "Vor Ort"],
  ["CUSTOM_LINK", "Eigener Link"],
] as const;

function NumberField({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" type="number" id={name} name={name} defaultValue={value} min={0} required />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EventTypeForm({
  action,
  eventType,
  members,
  selectedHosts,
}: {
  action: (formData: FormData) => Promise<void>;
  eventType?: EventType;
  members: Member[];
  selectedHosts: { userId: string; required: boolean; weight: number }[];
}) {
  const et = eventType;
  const rules = parseRules(et?.negotiation);
  return (
    <form action={action} className="card space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">Titel</label>
          <input className="input" id="title" name="title" defaultValue={et?.title} required />
        </div>
        <div>
          <label className="label" htmlFor="slug">URL-Kürzel</label>
          <input className="input" id="slug" name="slug" defaultValue={et?.slug} placeholder="wird aus dem Titel erzeugt" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Beschreibung (auf der Buchungsseite sichtbar)</label>
        <textarea className="input" id="description" name="description" rows={3} defaultValue={et?.description ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField name="durationMin" label="Dauer (Min.)" value={et?.durationMin ?? 30} />
        <NumberField name="bufferBeforeMin" label="Puffer davor (Min.)" value={et?.bufferBeforeMin ?? 0} />
        <NumberField name="bufferAfterMin" label="Puffer danach (Min.)" value={et?.bufferAfterMin ?? 0} />
        <NumberField name="minNoticeMin" label="Mindestvorlauf (Min.)" value={et?.minNoticeMin ?? 240} />
        <NumberField name="maxDaysAhead" label="Buchbar bis (Tage im Voraus)" value={et?.maxDaysAhead ?? 60} />
        <NumberField name="slotStepMin" label="Zeitraster (Min.)" value={et?.slotStepMin ?? 15} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mode">Gastgeber-Modus</label>
          <select className="input" id="mode" name="mode" defaultValue={et?.mode ?? "SINGLE"}>
            {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="maxGuests">Kollegen, die Buchende mit einladen dürfen</label>
          <input className="input" type="number" id="maxGuests" name="maxGuests" min={0} max={20} defaultValue={et?.maxGuests ?? 3} />
        </div>
        <div>
          <label className="label" htmlFor="locationType">Ort</label>
          <select className="input" id="locationType" name="locationType" defaultValue={et?.locationType ?? "GOOGLE_MEET"}>
            {LOCATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="locationValue">Ortsangabe (Adresse, Telefon oder Link)</label>
          <input className="input" id="locationValue" name="locationValue" defaultValue={et?.locationValue ?? ""} />
          <p className="mt-1 text-xs text-slate-500">
            Bei Zoom und Teams wird der Link automatisch erzeugt, wenn der Gastgeber Zoom bzw. Microsoft 365 verbunden hat.
            Sonst wird der hier eingetragene feste Link verwendet.
          </p>
        </div>
      </div>
      <fieldset>
        <legend className="label">Gastgeber</legend>
        <p className="mb-2 text-xs text-slate-500">
          Kollektiv: optionale Gastgeber werden eingeladen, wenn sie frei sind, blockieren aber keine Zeiten.
          Round Robin: höhere Gewichtung bekommt anteilig mehr Termine.
        </p>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {members.map((m) => {
            const sel = selectedHosts.find((h) => h.userId === m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-4 px-3 py-2 text-sm">
                <label className="flex min-w-48 flex-1 items-center gap-2">
                  <input type="checkbox" name="hostIds" value={m.id} defaultChecked={!!sel} />
                  {m.name ?? m.email}
                </label>
                <label className="flex items-center gap-1 text-slate-600">
                  <input type="checkbox" name={`optional_${m.id}`} defaultChecked={sel ? !sel.required : false} />
                  optional
                </label>
                <label className="flex items-center gap-1 text-slate-600">
                  Gewichtung
                  <input
                    className="input py-1"
                    style={{ width: 72 }}
                    type="number"
                    min={1}
                    max={10}
                    name={`weight_${m.id}`}
                    defaultValue={sel?.weight ?? 1}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">KI-Terminverhandlung</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="neg_enabled" defaultChecked={rules.enabled} />
          Wenn keine Zeit passt, darf der Assistent Alternativen aushandeln
        </label>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="neg_extendedStart">Frühester Beginn</label>
            <input className="input" type="time" id="neg_extendedStart" name="neg_extendedStart" defaultValue={rules.extendedStart} />
          </div>
          <div>
            <label className="label" htmlFor="neg_extendedEnd">Spätestes Ende</label>
            <input className="input" type="time" id="neg_extendedEnd" name="neg_extendedEnd" defaultValue={rules.extendedEnd} />
          </div>
          <div>
            <label className="label" htmlFor="neg_minNoticeMin">Mindestvorlauf (Min.)</label>
            <input className="input" type="number" min={0} id="neg_minNoticeMin" name="neg_minNoticeMin" defaultValue={rules.minNoticeMin} />
          </div>
          <div>
            <label className="label" htmlFor="neg_maxTurns">Max. Nachrichten</label>
            <input className="input" type="number" min={1} max={50} id="neg_maxTurns" name="neg_maxTurns" defaultValue={rules.maxTurns} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="neg_autoBook" defaultChecked={rules.autoBookExtended} />
          Erweiterte Werktagszeiten ohne Rückfrage buchen (sonst Freigabe per E-Mail)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="neg_allowWeekends" defaultChecked={rules.allowWeekends} />
          Wochenende anbieten (immer mit Freigabe)
        </label>
        <div>
          <label className="label" htmlFor="neg_instructions">Hinweise für den Assistenten (optional)</label>
          <textarea className="input" rows={2} id="neg_instructions" name="neg_instructions" defaultValue={rules.instructions}
            placeholder="z.B. Freitags nachmittags nur im Notfall anbieten." />
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={et?.active ?? true} /> Aktiv (auf der Buchungsseite sichtbar)
      </label>
      <button className="btn">Speichern</button>
    </form>
  );
}
