import { db } from "@/lib/db";
import { requireMember } from "@/lib/session";
import type { WeeklyHours } from "@/lib/availability";
import { saveSchedule } from "../actions";

const DAYS = [
  ["1", "Montag"], ["2", "Dienstag"], ["3", "Mittwoch"], ["4", "Donnerstag"],
  ["5", "Freitag"], ["6", "Samstag"], ["7", "Sonntag"],
] as const;

const TIME_ZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "America/New_York", "UTC"];

export default async function AvailabilityPage() {
  const { user } = await requireMember();
  const schedule = await db.schedule.findUnique({ where: { userId: user.id } });
  const weekly = (schedule?.weekly ?? {}) as WeeklyHours;
  const tz = schedule?.timeZone ?? user.timeZone;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Verfügbarkeit</h1>
      <p className="text-sm text-slate-600">
        Innerhalb dieser Zeiten werden Termine angeboten. Belegte Zeiten aus deinem Google Kalender werden automatisch
        ausgespart.
      </p>
      <form action={saveSchedule} className="card space-y-4">
        <div className="max-w-xs">
          <label className="label" htmlFor="timeZone">Zeitzone</label>
          <select className="input" id="timeZone" name="timeZone" defaultValue={tz}>
            {(TIME_ZONES.includes(tz) ? TIME_ZONES : [tz, ...TIME_ZONES]).map((z) => <option key={z}>{z}</option>)}
          </select>
        </div>
        <div className="divide-y divide-slate-100">
          {DAYS.map(([d, label]) => {
            const range = weekly[d]?.[0];
            return (
              <div key={d} className="flex items-center gap-4 py-2">
                <label className="flex w-36 items-center gap-2 text-sm">
                  <input type="checkbox" name={`on_${d}`} defaultChecked={!!range} /> {label}
                </label>
                <input className="input w-32" type="time" name={`start_${d}`} defaultValue={range?.start ?? "09:00"} />
                <span className="text-slate-400">bis</span>
                <input className="input w-32" type="time" name={`end_${d}`} defaultValue={range?.end ?? "17:00"} />
              </div>
            );
          })}
        </div>
        <button className="btn">Speichern</button>
      </form>
    </div>
  );
}
