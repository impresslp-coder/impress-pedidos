"use client";

import { useMemo } from "react";
import Link from "next/link";

type Pedido = {
  id: string;
  numero: string;
  estado: string;
  prioridad: string | null;
  fecha: string | null;
  creado_en: string | null;
  sucursal_produccion: string | null;
  sucursal_retiro: string | null;
  mensaje: string | null;
  clientes: { nombre: string } | null;
  items_pedido: { producto: string; precio: number }[];
};

type ColumnaKey = "recibido" | "proceso" | "listo";

const COLUMNAS: {
  key: ColumnaKey;
  estado: string;
  titulo: string;
  descripcion: string;
  colorBadge: string;
  colorHeader: string;
  colorBorde: string;
}[] = [
  {
    key: "recibido",
    estado: "Encargo recibido",
    titulo: "Pendientes",
    descripcion: "Esperando iniciar producción",
    colorBadge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    colorHeader: "text-indigo-700",
    colorBorde: "border-indigo-200",
  },
  {
    key: "proceso",
    estado: "En producción",
    titulo: "En producción",
    descripcion: "Se están imprimiendo / preparando",
    colorBadge: "bg-amber-100 text-amber-700 border-amber-200",
    colorHeader: "text-amber-700",
    colorBorde: "border-amber-200",
  },
  {
    key: "listo",
    estado: "Listo para entregar",
    titulo: "Listos para entregar",
    descripcion: "Esperando al cliente",
    colorBadge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    colorHeader: "text-emerald-700",
    colorBorde: "border-emerald-200",
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

export default function ColaProduccionClient({ pedidosIniciales }: { pedidosIniciales: Pedido[] }) {
  const porColumna = useMemo(() => {
    const grupos: Record<ColumnaKey, Pedido[]> = { recibido: [], proceso: [], listo: [] };
    for (const p of pedidosIniciales) {
      const col = COLUMNAS.find((c) => c.estado === p.estado);
      if (col) grupos[col.key].push(p);
    }
    return grupos;
  }, [pedidosIniciales]);

  const totalActivos = pedidosIniciales.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span>{totalActivos} pedidos activos</span>
        <span>Orden automático: alta → normal → baja · fecha</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNAS.map((col) => {
          const lista = porColumna[col.key];
          return (
            <div key={col.key} className={`bg-white rounded-2xl border-2 ${col.colorBorde} shadow-sm flex flex-col`}>
              <div className="px-4 py-3 border-b border-zinc-100">
                <div className="flex items-center justify-between">
                  <h2 className={`text-sm font-black uppercase tracking-wide ${col.colorHeader}`}>
                    {col.titulo}
                  </h2>
                  <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-black ${col.colorBadge} border`}>
                    {lista.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{col.descripcion}</p>
              </div>

              <div className="p-3 space-y-2 min-h-[80px]">
                {lista.length === 0 && (
                  <div className="text-xs text-zinc-300 text-center py-8 italic">
                    Sin pedidos en esta etapa
                  </div>
                )}

                {lista.map((p) => {
                  const items = p.items_pedido ?? [];
                  const total = items.reduce((a, i) => a + (i.precio ?? 0), 0);
                  const prioridad = ["alta", "normal", "baja"].includes(p.prioridad ?? "") ? p.prioridad! : "normal";

                  return (
                    <div key={p.id}
                      className={`rounded-xl border-2 shadow-sm transition ${prioridad === "alta" ? "border-red-300 bg-red-50/30" : prioridad === "baja" ? "border-zinc-200 bg-zinc-50" : "border-blue-200 bg-white"}`}>
                      <div className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/pedidos/${p.id}`}
                                className="font-mono font-black text-[#1a1a2e] hover:text-[#f5a623] text-sm transition">
                                #{parseInt(p.numero, 10)}
                              </Link>
                              <PrioridadBadge prioridad={prioridad} />
                            </div>
                            <p className="text-xs font-semibold text-zinc-700 mt-0.5 truncate">
                              {(p.clientes as any)?.nombre ?? "Sin cliente"}
                            </p>
                            {items.length > 0 && (
                              <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                                {items.map((i) => i.producto).join(" · ")}
                              </p>
                            )}
                            {p.sucursal_produccion && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">
                                📍 {p.sucursal_produccion}
                              </p>
                            )}
                            {p.mensaje && (
                              <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-block max-w-full truncate">
                                💬 {p.mensaje}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <p className="text-xs font-black text-[#f5a623]">{fmt(total)}</p>
                          </div>
                        </div>

                        <p className="mt-2 text-[10px] text-zinc-400">Abrí el detalle para avanzar el pedido respetando el flujo.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {totalActivos === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400">
          No hay pedidos activos.
        </div>
      )}
    </div>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const estilos: Record<string, string> = {
    alta: "bg-red-100 text-red-700 border-red-200",
    normal: "bg-blue-100 text-blue-700 border-blue-200",
    baja: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  const nombre: Record<string, string> = { alta: "Alta", normal: "Normal", baja: "Baja" };
  return <span className={`inline-flex rounded border px-1.5 py-0 text-[10px] font-bold ${estilos[prioridad]}`}>{nombre[prioridad]}</span>;
}
