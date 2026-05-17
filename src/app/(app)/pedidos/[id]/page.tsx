import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PedidoDetalleEditor from "./pedido-detalle-editor";

export const dynamic = "force-dynamic";

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const admin = createAdminClient();

  const { data: pedido } = await admin
    .from("pedidos")
    .select(`
      *,
      clientes ( nombre, telefono, cod_pais, mail ),
      items_pedido ( * ),
      archivos_pedido ( * ),
      usuarios_sistema ( nombre )
    `)
    .eq("id", id)
    .single();

  if (!pedido) notFound();

  const items = ((pedido as any).items_pedido as any[]) ?? [];
  const archivos = ((pedido as any).archivos_pedido as any[]) ?? [];
  const usuario = (pedido as any).usuarios_sistema as any;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/pedidos" className="text-zinc-400 hover:text-zinc-600 text-sm">
              Volver a pedidos
            </Link>
            <span className="text-zinc-300">|</span>
            <h1 className="text-2xl font-black font-mono text-[#1a1a2e]">#{(pedido as any).numero}</h1>
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            {(pedido as any).fecha ? new Date((pedido as any).fecha).toLocaleString("es-AR") : "-"}
            {usuario?.nombre && ` · Por ${usuario.nombre}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a href={`/api/pdf/pedido/${id}?tipo=resumen`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] text-white text-xs font-bold hover:bg-zinc-800 transition">
            Resumen PDF
          </a>
          <a href={`/api/pdf/pedido/${id}?tipo=ticket`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#f5a623] text-[#1a1a2e] text-xs font-bold hover:bg-amber-400 transition">
            Ticket pedido
          </a>
          {["Listo para retirar", "Entregado"].includes(String((pedido as any).estado ?? "")) && (
            <a href={`/api/pdf/pedido/${id}?tipo=entrega`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition">
              Ticket entrega
            </a>
          )}
        </div>
      </div>

      <PedidoDetalleEditor pedido={pedido as any} itemsIniciales={items} archivos={archivos} />
    </div>
  );
}
