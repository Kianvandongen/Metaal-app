import { createClient } from "@/lib/supabase/server";

export type Rol = "beheerder" | "sales" | "calculator" | "werkplaats" | "administratie";

/** Het bedrijf van de ingelogde gebruiker (pilot: één bedrijf per gebruiker). */
export async function huidigLidmaatschap() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("leden")
    .select("rol, bedrijf:bedrijven(id, naam)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Lidmaatschap ophalen mislukt: ${error.message}`);
  if (!data?.bedrijf) return null;
  const bedrijf = Array.isArray(data.bedrijf) ? data.bedrijf[0] : data.bedrijf;
  return { rol: data.rol as Rol, bedrijf: bedrijf as { id: string; naam: string }, userId };
}
