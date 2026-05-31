import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TerciarizadosListClient from "./terciarizados-list-client";

export const dynamic = "force-dynamic";

export default async function TerciarizadosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: perfil } = user
    ? await admin.from("usuarios_sistema").select("rol").eq("id", user!.id).single()
    : { data: null };
  const esAdmin = (perfil as any)?.rol === "admin";

  const { data: encargos } = await admin
    .from("terciarizados")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">Encargos terciarizados</h1>
        <Link
          href="/terciarizados/nuevo"
          className="px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] transition"
        >
          + Nuevo encargo
        </Link>
      </div>

      <TerciarizadosListClient
        encargos={(encargos as any[]) ?? []}
        esAdmin={esAdmin}
      />
    </div>
  );
}
