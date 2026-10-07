"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { huidigLidmaatschap } from "@/lib/bedrijf";
import { createClient } from "@/lib/supabase/server";

const Tarief = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, "Code: kleine letters, cijfers en _"),
  omschrijving: z.string().trim().min(2, "Vul een omschrijving in"),
  eenheid: z.enum(["uur", "kg", "km", "stuk", "dag", "m", "m2", "pct"]),
  bedrag: z.coerce.number().min(0, "Bedrag mag niet negatief zijn").max(1_000_000),
  geldig_vanaf: z.iso.date("Ongeldige datum"),
  bron: z.string().trim().max(200).optional(),
});

export type TariefStatus = { fout?: string; ok?: boolean };

export async function tariefToevoegen(_: TariefStatus, form: FormData): Promise<TariefStatus> {
  const lid = await huidigLidmaatschap();
  if (!lid) return { fout: "Niet gekoppeld aan een bedrijf." };
  const t = Tarief.safeParse(Object.fromEntries(form));
  if (!t.success) return { fout: t.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("tarieven").insert({ ...t.data, bedrijf_id: lid.bedrijf.id });
  if (error?.code === "23505") return { fout: "Er bestaat al een tarief met deze code en datum." };
  if (error?.code === "42501") return { fout: "Je rol mag geen tarieven toevoegen." };
  if (error) return { fout: `Opslaan mislukt: ${error.message}` };
  revalidatePath("/tarieven");
  return { ok: true };
}
