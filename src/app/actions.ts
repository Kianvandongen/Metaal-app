"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type FormStatus = { fout?: string };

export async function bedrijfAanmaken(_: FormStatus, form: FormData): Promise<FormStatus> {
  const naam = z.string().trim().min(2, "Vul een bedrijfsnaam in").safeParse(form.get("naam"));
  if (!naam.success) return { fout: naam.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("maak_bedrijf", { p_naam: naam.data });
  if (error) return { fout: `Bedrijf aanmaken mislukt: ${error.message}` };
  revalidatePath("/");
  return {};
}
