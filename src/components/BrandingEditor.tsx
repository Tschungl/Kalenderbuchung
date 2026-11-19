"use client";

import { useState } from "react";
import { BUTTON_STYLES, FONT_STYLES, PAGE_THEMES, brandingStyle, type Branding } from "@/lib/branding";

type Props = {
  initial: Branding;
  orgName: string;
  sampleEvents: { title: string; durationMin: number }[];
  disabled: boolean;
  action: (formData: FormData) => Promise<void>;
};

const PRESET_COLORS = ["#2563eb", "#0f766e", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0f172a"];

export function BrandingEditor({ initial, orgName, sampleEvents, disabled, action }: Props) {
  const [b, setB] = useState<Branding>(initial);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setB((x) => ({ ...x, [k]: v }));
  const { className, style } = brandingStyle(b);
  const events = sampleEvents.length ? sampleEvents.slice(0, 3) : [{ title: "Erstgespräch", durationMin: 30 }];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form action={action} className="card space-y-5">
        <fieldset disabled={disabled} className="space-y-5">
          <div>
            <label className="label" htmlFor="brandColor">Markenfarbe</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => set("brandColor", c)}
                  className={`h-8 w-8 rounded-full border-2 ${b.brandColor === c ? "border-slate-900" : "border-white"}`}
                  style={{ backgroundColor: c, boxShadow: "0 0 0 1px #cbd5e1" }}
                />
              ))}
              <input
                type="color"
                id="brandColor"
                name="brandColor"
                value={b.brandColor}
                onChange={(e) => set("brandColor", e.target.value)}
                className="h-8 w-12 rounded border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="logoUrl">Logo (URL)</label>
            <input className="input" id="logoUrl" name="logoUrl" type="url" value={b.logoUrl ?? ""} placeholder="https://…/logo.png" onChange={(e) => set("logoUrl", e.target.value || null)} />
          </div>
          <div>
            <label className="label" htmlFor="welcomeTitle">Überschrift der Buchungsseite</label>
            <input className="input" id="welcomeTitle" name="welcomeTitle" maxLength={120} value={b.welcomeTitle ?? ""} placeholder={`Termin mit ${orgName} buchen`} onChange={(e) => set("welcomeTitle", e.target.value || null)} />
          </div>
          <div>
            <label className="label" htmlFor="welcomeText">Begrüßungstext</label>
            <textarea className="input" id="welcomeText" name="welcomeText" rows={3} maxLength={2000} value={b.welcomeText ?? ""} placeholder="Wählen Sie ein passendes Gespräch. Wir freuen uns auf Sie!" onChange={(e) => set("welcomeText", e.target.value || null)} />
          </div>
          <div>
            <label className="label" htmlFor="confirmationText">Text nach der Buchung</label>
            <textarea className="input" id="confirmationText" name="confirmationText" rows={2} maxLength={1000} value={b.confirmationText ?? ""} placeholder="Vielen Dank! Bitte halten Sie Ihre Unterlagen bereit." onChange={(e) => set("confirmationText", e.target.value || null)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Choice label="Schrift" name="fontStyle" options={FONT_STYLES} value={b.fontStyle} onChange={(v) => set("fontStyle", v)} />
            <Choice label="Buttons" name="buttonStyle" options={BUTTON_STYLES} value={b.buttonStyle} onChange={(v) => set("buttonStyle", v)} />
            <Choice label="Hintergrund" name="pageTheme" options={PAGE_THEMES} value={b.pageTheme} onChange={(v) => set("pageTheme", v)} />
          </div>
          {!disabled && <button className="btn">Gestaltung speichern</button>}
        </fieldset>
        {disabled && <p className="text-sm text-slate-500">Nur Inhaber und Admins können das ändern.</p>}
      </form>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-500">Vorschau</p>
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className={`branded ${className}`} style={{ ...style, minHeight: 0 }}>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                {b.logoUrl && <img src={b.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <span className="text-lg font-semibold">{orgName}</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold">{b.welcomeTitle || `Termin mit ${orgName} buchen`}</h2>
                {b.welcomeText && <p className="mt-2 whitespace-pre-line text-sm opacity-80">{b.welcomeText}</p>}
              </div>
              {events.map((e) => (
                <div key={e.title} className="card border-l-4 p-4" style={{ borderLeftColor: b.brandColor }}>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-slate-500">{e.durationMin} Minuten</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {["09:00", "09:30", "10:00"].map((t) => (
                  <span key={t} className="slot-btn px-3 py-1.5 text-sm">{t}</span>
                ))}
                <span className="brand-btn px-4 py-1.5 text-sm">Termin buchen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Choice<T extends Record<string, string>>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: T;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}
