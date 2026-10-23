import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ColaProduccionClient from "./cola-client";

export const dynamic = "force-dynamic";

const ESTADOS_ACTIVOS = ["Encargo recibido", "En producción", "Listo para entregar"];

export default async function ColaProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") redirect("/pedidos");

  const { data: pedidos } = await admin
    .from("pedidos")
    .select(`
      id, numero, estado, prioridad, fecha, creado_en,
      sucursal_produccion, sucursal_retiro, mensaje,
      clientes ( nombre ),
      items_pedido ( producto, precio )
    `)
    .in("estado", ESTADOS_ACTIVOS);

  const ordenPrioridad: Record<string, number> = { alta: 0, normal: 1, baja: 2 };
  const pedidosOrdenados = [...((pedidos as any[]) ?? [])].sort((a, b) => {
    const prioridadA = ordenPrioridad[a.prioridad ?? "normal"] ?? 1;
    const prioridadB = ordenPrioridad[b.prioridad ?? "normal"] ?? 1;
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;
    const fechaA = new Date(a.fecha ?? a.creado_en ?? 0).getTime();
    const fechaB = new Date(b.fecha ?? b.creado_en ?? 0).getTime();
    if (fechaA !== fechaB) return fechaA - fechaB;
    return String(a.numero).localeCompare(String(b.numero), "es", { numeric: true });
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Pendientes</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tablero de producción. Se ordena por prioridad de los ítems (alta, normal, baja) y luego por fecha del pedido.
        </p>
      </div>
      <ColaProduccionClient pedidosIniciales={pedidosOrdenados} />
    </div>
  );
}
