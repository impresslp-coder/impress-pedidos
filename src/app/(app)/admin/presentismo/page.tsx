import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PresentismoClient from "./presentismo-client";

export const dynamic = "force-dynamic";

export default async function PresentismoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") redirect("/pedidos");

  // Semana actual
  const hoy = new Date();
  const d = hoy.getDay();
  const diff = d === 0 ? -6 : 1 - d;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const desde = lunes.toISOString().split("T")[0];
  const hasta = domingo.toISOString().split("T")[0];

  const [{ data: usuarios }, { data: registros }] = await Promise.all([
    admin.from("usuarios_sistema").select("id, nombre, rol").order("nombre"),
    admin.from("asistencia").select("*").gte("fecha", desde).lte("fecha", hasta),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Presentismo</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Registro de asistencia del equipo. La entrada se registra automáticamente al iniciar sesión.
        </p>
      </div>
      <PresentismoClient
        usuariosIniciales={(usuarios as any[]) ?? []}
        registrosIniciales={(registros as any[]) ?? []}
        semanaInicial={{ desde, hasta }}
      />
    </div>
  );
}
