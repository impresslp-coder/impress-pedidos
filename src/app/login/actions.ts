"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginState = { error?: string };

function safeInternalRedirect(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const base = "https://impress-office.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = safeInternalRedirect(String(formData.get("redirect") || "/"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos" };
  }

  const { data: perfil, error: perfilError } = await createAdminClient()
    .from("usuarios_sistema")
    .select("activo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (perfilError || perfil?.activo !== true) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Este usuario no está habilitado para ingresar" };
  }

  redirect(redirectTo);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
