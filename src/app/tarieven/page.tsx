import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { huidigLidmaatschap } from "@/lib/bedrijf";
import { createClient } from "@/lib/supabase/server";
import { TariefFormulier } from "./formulier";

interface TariefRij {
  id: string;
  code: string;
  omschrijving: string;
  eenheid: string;
  bedrag: number;
  geldig_vanaf: string;
  bron: string | null;
}

export default function Tarieven() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Laden…</p>}>
      <TarievenInhoud />
    </Suspense>
  );
}

async function TarievenInhoud() {
  const lid = await huidigLidmaatschap();
  if (!lid) redirect("/");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarieven")
    .select("id, code, omschrijving, eenheid, bedrag, geldig_vanaf, bron")
    .order("code")
    .order("geldig_vanaf", { ascending: false });
  if (error) throw new Error(`Tarieven ophalen mislukt: ${error.message}`);
  const rijen = (data ?? []) as TariefRij[];
  const vandaag = new Date().toISOString().slice(0, 10);
  // Per code het nieuwste tarief dat al ingegaan is (rijen staan nieuwste eerst).
  const actueelPerCode = new Map<string, string>();
  for (const r of rijen) {
    if (r.geldig_vanaf <= vandaag && !actueelPerCode.has(r.code)) actueelPerCode.set(r.code, r.id);
  }
  const actueel = new Set(actueelPerCode.values());
  const magToevoegen = lid.rol === "beheerder" || lid.rol === "calculator";

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Link href="/" className="text-sm underline">
        ← Terug
      </Link>
      <h1 className="my-4 text-2xl font-semibold">Tarieven</h1>
      <p className="mb-4 text-sm text-zinc-600">
        Tarieven worden nooit overschreven. Een nieuw bedrag krijgt een eigen ingangsdatum, zodat oude calculaties
        herleidbaar blijven.
      </p>
      {magToevoegen && (
        <div className="mb-6">
          <TariefFormulier />
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Code</th>
            <th>Omschrijving</th>
            <th className="text-right">Bedrag</th>
            <th>Eenheid</th>
            <th>Geldig vanaf</th>
            <th>Bron</th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.id} className={`border-b ${actueel.has(r.id) ? "font-medium" : "text-zinc-400"}`}>
              <td className="py-1">{r.code}</td>
              <td>{r.omschrijving}</td>
              <td className="text-right tabular-nums">€ {Number(r.bedrag).toFixed(2)}</td>
              <td>{r.eenheid}</td>
              <td>{r.geldig_vanaf}</td>
              <td>{r.bron}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
