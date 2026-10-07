"use client";

import { useActionState } from "react";
import { tariefToevoegen, type TariefStatus } from "./actions";

export function TariefFormulier() {
  const [status, actie, bezig] = useActionState<TariefStatus, FormData>(tariefToevoegen, {});
  const vandaag = new Date().toISOString().slice(0, 10);
  return (
    <form action={actie} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      <input name="code" placeholder="code, bv. zagen" required className="rounded border px-2 py-1" />
      <input name="omschrijving" placeholder="Omschrijving" required className="rounded border px-2 py-1" />
      <select name="eenheid" className="rounded border px-2 py-1">
        {["uur", "kg", "km", "stuk", "dag", "m", "m2", "pct"].map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
      <input name="bedrag" type="number" step="0.0001" min="0" placeholder="Bedrag €" required className="rounded border px-2 py-1" />
      <input name="geldig_vanaf" type="date" defaultValue={vandaag} required className="rounded border px-2 py-1" />
      <input name="bron" placeholder="Bron (optioneel)" className="rounded border px-2 py-1" />
      <button disabled={bezig} className="col-span-full rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
        Tarief toevoegen
      </button>
      {status.fout && <p className="col-span-full text-red-700">{status.fout}</p>}
      {status.ok && <p className="col-span-full text-green-700">Opgeslagen.</p>}
    </form>
  );
}
