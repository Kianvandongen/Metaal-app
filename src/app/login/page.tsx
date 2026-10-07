"use client";

import { useActionState } from "react";
import { inloggen, registreren, type LoginStatus } from "./actions";

export default function LoginPagina() {
  const [inlog, inlogActie, bezig1] = useActionState<LoginStatus, FormData>(inloggen, {});
  const [reg, regActie, bezig2] = useActionState<LoginStatus, FormData>(registreren, {});
  const status = reg.fout || reg.melding ? reg : inlog;

  return (
    <main className="mx-auto w-full max-w-sm p-6 pt-24">
      <h1 className="mb-6 text-2xl font-semibold">Inloggen</h1>
      <form className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="rounded border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Wachtwoord
          <input name="wachtwoord" type="password" required minLength={10} autoComplete="current-password" className="rounded border px-3 py-2" />
        </label>
        {status.fout && <p className="text-sm text-red-700">{status.fout}</p>}
        {status.melding && <p className="text-sm text-green-700">{status.melding}</p>}
        <button formAction={inlogActie} disabled={bezig1 || bezig2} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
          Inloggen
        </button>
        <button formAction={regActie} disabled={bezig1 || bezig2} className="rounded border px-4 py-2 disabled:opacity-50">
          Account aanmaken
        </button>
      </form>
    </main>
  );
}
