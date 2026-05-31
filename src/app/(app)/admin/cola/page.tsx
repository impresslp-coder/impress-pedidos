import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ColaProduccionClient from "./cola-client";

export const dynamic = "force-dynamic";

const ESTADOS_ACTIVOS = ["Encargo recibido", "En proceso", "Listo para retirar"];

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
      id, numero, estado, prioridad, orden_produccion,
      sucursal_produccion, sucursal_retiro, mensaje,
      clientes ( nombre ),
      items_pedido ( producto, precio )
    `)
    .in("estado", ESTADOS_ACTIVOS)
    .order("orden_produccion", { ascending: true })
    .order("numero", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Cola de producción</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Ordená manualmente los pedidos activos según prioridad de producción.
          Los operarios ven esta lista en orden.
        </p>
      </div>
      <ColaProduccionClient pedidosIniciales={(pedidos as any[]) ?? []} />
    </div>
  );
}
