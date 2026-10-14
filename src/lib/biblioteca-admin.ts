import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CategoryKind = "level" | "institution" | "career" | "subject";

export async function isBibliotecaAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const staff = createAdminClient();
  const { data: profile, error } = await staff
    .from("usuarios_sistema")
    .select("rol, activo")
    .eq("id", user.id)
    .single();
  return !error && profile?.activo === true && profile.rol === "admin";
}

export function createBibliotecaAdminClient() {
  const url = process.env.BIBLIOTECA_SUPABASE_URL;
  const key = process.env.BIBLIOTECA_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Configuración de Biblioteca incompleta");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function categorySlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isOwnOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const url = new URL(request.url);
  return origin === url.origin;
}
