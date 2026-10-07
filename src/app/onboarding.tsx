"use client";

import { useActionState } from "react";
import { bedrijfAanmaken, type FormStatus } from "./actions";

export function Onboarding() {
  const [status, actie, bezig] = useActionState<FormStatus, FormData>(bedrijfAanmaken, {});
  return (
    <form action={actie} className="flex max-w-sm flex-col gap-3">
      <p>Je bent nog niet gekoppeld aan een bedrijf. Maak er een aan; je wordt dan beheerder.</p>
      <input name="naam" placeholder="Bedrijfsnaam" required className="rounded border px-3 py-2" />
      {status.fout && <p className="text-sm text-red-700">{status.fout}</p>}
      <button disabled={bezig} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
        Bedrijf aanmaken
      </button>
    </form>
  );
}
