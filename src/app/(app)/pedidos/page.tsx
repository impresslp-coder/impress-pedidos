import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PedidosListClient, { type FilaUnificada } from "./pedidos-list-client";

export const dynamic = "force-dynamic";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const { estado, q } = await searchParams;
  const supabase = await createClient();

  let pedidos: any[] | null = null;
  const pedidosConOperacion = await supabase
    .from("pedidos")
    .select(`id, numero, codigo_unico, fecha, estado, sucursal, ubicacion, senia, prioridad, eliminado, queja_motivo, mercado_pago_payment_id, mercado_pago_monto, mercado_pago_hora, clientes ( nombre, telefono, cod_pais ), items_pedido ( producto, paginas, modo, precio )`)
    .order("creado_en", { ascending: false })
    .limit(200);

  if (pedidosConOperacion.error) {
    const fallback = await supabase
      .from("pedidos")
      .select(`id, numero, codigo_unico, fecha, estado, sucursal, senia, prioridad, clientes ( nombre, telefono, cod_pais ), items_pedido ( producto, paginas, modo, precio )`)
      .order("creado_en", { ascending: false })
      .limit(200);
    pedidos = (fallback.data as any[]) ?? [];
  } else {
    pedidos = (pedidosConOperacion.data as any[]) ?? [];
  }

  const [{ data: terciarizados }, { data: sucursales }] = await Promise.all([
    supabase
      .from("terciarizados")
      .select("id, numero, creado_en, estado, sucursal, cliente, telefono")
      .order("creado_en", { ascending: false })
      .limit(200),
    supabase
      .from("sucursales")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const filasPedidos: FilaUnificada[] = (pedidos ?? []).map((p) => {
    const items = (p.items_pedido ?? []) as any[];
    const total = items.reduce((acc, item) => acc + (Number(item.precio) || 0), 0);
    return {
      id: p.id,
      numero: p.numero ?? "-",
      codigo_unico: p.codigo_unico ?? null,
      fecha: p.fecha ?? null,
      estado: p.estado ?? null,
      sucursal: p.sucursal ?? null,
      ubicacion: p.ubicacion ?? null,
      cliente: p.clientes?.nombre ?? "-",
      telefono: p.clientes?.telefono ?? null,
      cod_pais: p.clientes?.cod_pais ?? null,
      tipo: "pedido",
      href: `/pedidos/${p.id}`,
      senia: Number(p.senia) || 0,
      total,
      items,
      eliminado: Boolean(p.eliminado) || p.estado === "Eliminado",
      prioridad: p.prioridad ?? null,
      queja_motivo: p.queja_motivo ?? null,
    };
  });

  const filasTerc: FilaUnificada[] = ((terciarizados as any[]) ?? []).map((t) => ({
    id: t.id,
    numero: t.numero ?? "E-????",
    codigo_unico: null,
    fecha: t.creado_en ?? null,
    estado: t.estado ?? null,
    sucursal: t.sucursal ?? null,
    ubicacion: null,
    cliente: t.cliente ?? "-",
    telefono: t.telefono ?? null,
    cod_pais: "54",
    tipo: "terciarizado",
    href: "/terciarizados",
    senia: 0,
    total: 0,
    items: [],
    eliminado: false,
    prioridad: null,
    queja_motivo: null,
  }));

  const todos = [...filasPedidos, ...filasTerc].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0;
    const db = b.fecha ? new Date(b.fecha).getTime() : 0;
    return db - da;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">Pedidos</h1>
        <Link
          href="/pedidos/nuevo"
          className="px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] transition"
        >
          + Nuevo pedido
        </Link>
      </div>

      <PedidosListClient
        filas={todos}
        sucursales={(sucursales as any[]) ?? []}
        initialQ={q ?? ""}
        initialEstado={estado ?? "Todos"}
      />
    </div>
  );
}
