"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Gegevens = z.object({
  email: z.email("Ongeldig e-mailadres"),
  wachtwoord: z.string().min(10, "Wachtwoord moet minimaal 10 tekens zijn"),
});

export type LoginStatus = { fout?: string; melding?: string };

export async function inloggen(_: LoginStatus, form: FormData): Promise<LoginStatus> {
  const g = Gegevens.safeParse({ email: form.get("email"), wachtwoord: form.get("wachtwoord") });
  if (!g.success) return { fout: g.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: g.data.email, password: g.data.wachtwoord });
  if (error) return { fout: "Inloggen mislukt. Controleer e-mail en wachtwoord." };
  redirect("/");
}

export async function registreren(_: LoginStatus, form: FormData): Promise<LoginStatus> {
  const g = Gegevens.safeParse({ email: form.get("email"), wachtwoord: form.get("wachtwoord") });
  if (!g.success) return { fout: g.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: g.data.email, password: g.data.wachtwoord });
  if (error) return { fout: `Account aanmaken mislukt: ${error.message}` };
  if (!data.session) return { melding: "Account aangemaakt. Bevestig je e-mailadres via de link in je mail." };
  redirect("/");
}

export async function uitloggen() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
