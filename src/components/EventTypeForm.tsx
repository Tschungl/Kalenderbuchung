import type { EventType } from "@prisma/client";

type Member = { id: string; name: string | null; email: string | null };

const MODES = [
  ["SINGLE", "Ein Gastgeber"],
  ["COLLECTIVE", "Kollektiv: alle Gastgeber müssen frei sein"],
  ["ROUND_ROBIN", "Round Robin: einer aus dem Team, reihum"],
] as const;

const LOCATIONS = [
  ["GOOGLE_MEET", "Google Meet (Link automatisch)"],
  ["PHONE", "Telefon"],
  ["IN_PERSON", "Vor Ort"],
  ["CUSTOM_LINK", "Eigener Link (z.B. Zoom)"],
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
  selectedHostIds,
}: {
  action: (formData: FormData) => Promise<void>;
  eventType?: EventType;
  members: Member[];
  selectedHostIds: string[];
}) {
  const et = eventType;
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
          <label className="label" htmlFor="maxGuests">Weitere Gäste erlaubt</label>
          <input className="input" type="number" id="maxGuests" name="maxGuests" min={0} max={20} defaultValue={et?.maxGuests ?? 0} />
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
        </div>
      </div>
      <fieldset>
        <legend className="label">Gastgeber</legend>
        <div className="space-y-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hostIds" value={m.id} defaultChecked={selectedHostIds.includes(m.id)} />
              {m.name ?? m.email}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={et?.active ?? true} /> Aktiv (auf der Buchungsseite sichtbar)
      </label>
      <button className="btn">Speichern</button>
    </form>
  );
}
