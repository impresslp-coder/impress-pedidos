"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

type Pedido = {
  id: string;
  numero: string;
  estado: string;
  prioridad: string | null;
  orden_produccion: number | null;
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
  siguienteEstado: string | null;
  siguienteLabel: string | null;
  colorBadge: string;
  colorHeader: string;
  colorBorde: string;
}[] = [
  {
    key: "recibido",
    estado: "Encargo recibido",
    titulo: "Pendientes",
    descripcion: "Esperando iniciar producción",
    siguienteEstado: "En proceso",
    siguienteLabel: "→ Iniciar producción",
    colorBadge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    colorHeader: "text-indigo-700",
    colorBorde: "border-indigo-200",
  },
  {
    key: "proceso",
    estado: "En proceso",
    titulo: "En producción",
    descripcion: "Se están imprimiendo / preparando",
    siguienteEstado: "Listo para retirar",
    siguienteLabel: "→ Marcar listo",
    colorBadge: "bg-amber-100 text-amber-700 border-amber-200",
    colorHeader: "text-amber-700",
    colorBorde: "border-amber-200",
  },
  {
    key: "listo",
    estado: "Listo para retirar",
    titulo: "Listos para retirar",
    descripcion: "Esperando al cliente",
    siguienteEstado: "Entregado",
    siguienteLabel: "→ Marcar entregado",
    colorBadge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    colorHeader: "text-emerald-700",
    colorBorde: "border-emerald-200",
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

export default function ColaProduccionClient({ pedidosIniciales }: { pedidosIniciales: Pedido[] }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState<string | null>(null);

  const porColumna = useMemo(() => {
    const grupos: Record<ColumnaKey, Pedido[]> = { recibido: [], proceso: [], listo: [] };
    for (const p of pedidos) {
      const col = COLUMNAS.find((c) => c.estado === p.estado);
      if (col) grupos[col.key].push(p);
    }
    return grupos;
  }, [pedidos]);

  const mover = async (columnaKey: ColumnaKey, pedidoId: string, direccion: -1 | 1) => {
    const lista = [...porColumna[columnaKey]];
    const idx = lista.findIndex((p) => p.id === pedidoId);
    if (idx < 0) return;
    const nuevoIdx = idx + direccion;
    if (nuevoIdx < 0 || nuevoIdx >= lista.length) return;

    [lista[idx], lista[nuevoIdx]] = [lista[nuevoIdx], lista[idx]];

    const idsColumna = new Set(lista.map((p) => p.id));
    setPedidos((prev) => {
      const otros = prev.filter((p) => !idsColumna.has(p.id));
      return [...otros, ...lista];
    });

    setError(undefined);
    startTransition(async () => {
      try {
        await Promise.all(
          lista.map((p, i) =>
            fetch("/api/admin/cola", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: p.id, orden_produccion: i }),
            })
          )
        );
      } catch {
        setError("Error al guardar el orden. Recargá la página.");
      }
    });
  };

  const cambiarEstado = async (pedidoId: string, nuevoEstado: string) => {
    setGuardando(pedidoId);
    setError(undefined);
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "No pude cambiar el estado");
      } else {
        setPedidos((prev) =>
          nuevoEstado === "Entregado"
            ? prev.filter((p) => p.id !== pedidoId)
            : prev.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
        );
      }
    } catch {
      setError("Error de red al cambiar el estado.");
    }
    setGuardando(null);
  };

  const setPrioridad = async (pedidoId: string, prioridad: string) => {
    setGuardando(pedidoId);
    try {
      await fetch(`/api/pedidos/${pedidoId}/prioridad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prioridad }),
      });
      setPedidos((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, prioridad } : p)));
    } catch {
      setError("Error al actualizar prioridad.");
    }
    setGuardando(null);
  };

  const totalActivos = pedidos.length;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span>{totalActivos} pedidos activos</span>
        {isPending && <span className="text-amber-500 font-medium">Guardando...</span>}
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

                {lista.map((p, idx) => {
                  const items = p.items_pedido ?? [];
                  const total = items.reduce((a, i) => a + (i.precio ?? 0), 0);
                  const esUrgente = p.prioridad === "urgente";

                  return (
                    <div key={p.id}
                      className={`rounded-xl border-2 shadow-sm transition ${
                        esUrgente ? "border-red-300 bg-red-50/30" : "border-zinc-200 bg-white"
                      }`}>
                      <div className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/pedidos/${p.id}`}
                                className="font-mono font-black text-[#1a1a2e] hover:text-[#f5a623] text-sm transition">
                                #{parseInt(p.numero, 10)}
                              </Link>
                              {esUrgente && (
                                <span className="inline-flex px-1.5 py-0 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                  URGENTE
                                </span>
                              )}
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
                            <div className="flex flex-col">
                              <button onClick={() => mover(col.key, p.id, -1)}
                                disabled={idx === 0 || isPending}
                                className="text-zinc-300 hover:text-[#1a1a2e] disabled:opacity-20 text-xs leading-none px-1"
                                title="Subir">▲</button>
                              <button onClick={() => mover(col.key, p.id, 1)}
                                disabled={idx === lista.length - 1 || isPending}
                                className="text-zinc-300 hover:text-[#1a1a2e] disabled:opacity-20 text-xs leading-none px-1"
                                title="Bajar">▼</button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <button type="button"
                            onClick={() => setPrioridad(p.id, esUrgente ? "normal" : "urgente")}
                            disabled={guardando === p.id}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition uppercase ${
                              esUrgente
                                ? "bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border border-transparent"
                            }`}>
                            {esUrgente ? "🔴 Quitar urgente" : "Marcar urgente"}
                          </button>
                          {col.siguienteEstado && col.siguienteLabel && (
                            <button type="button"
                              onClick={() => cambiarEstado(p.id, col.siguienteEstado!)}
                              disabled={guardando === p.id}
                              className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-bold transition ${col.colorBadge} border hover:opacity-80`}>
                              {guardando === p.id ? "..." : col.siguienteLabel}
                            </button>
                          )}
                        </div>
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
