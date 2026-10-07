import Link from "next/link";
import { Suspense } from "react";
import { huidigLidmaatschap } from "@/lib/bedrijf";
import { uitloggen } from "./login/actions";
import { Onboarding } from "./onboarding";

export default function Start() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Laden…</p>}>
      <StartInhoud />
    </Suspense>
  );
}

async function StartInhoud() {
  const lid = await huidigLidmaatschap();
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{lid ? lid.bedrijf.naam : "Metaal-app"}</h1>
        <form action={uitloggen}>
          <button className="text-sm underline">Uitloggen</button>
        </form>
      </header>
      {lid ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600">Je rol: {lid.rol}</p>
          <Link href="/tarieven" className="underline">
            Tarieven
          </Link>
        </section>
      ) : (
        <Onboarding />
      )}
    </main>
  );
}
