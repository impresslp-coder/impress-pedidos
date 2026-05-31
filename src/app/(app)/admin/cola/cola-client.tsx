"use client";

import { useState, useTransition } from "react";
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

const ESTADO_COLOR: Record<string, string> = {
  "Encargo recibido": "bg-indigo-100 text-indigo-700",
  "En proceso":       "bg-amber-100 text-amber-700",
  "Listo para retirar": "bg-emerald-100 text-emerald-700",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

export default function ColaProduccionClient({ pedidosIniciales }: { pedidosIniciales: Pedido[] }) {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState<string | null>(null); // id del pedido que se está guardando

  const mover = async (idx: number, direccion: -1 | 1) => {
    const nuevoIdx = idx + direccion;
    if (nuevoIdx < 0 || nuevoIdx >= pedidos.length) return;

    // Swap en UI
    const nuevaLista = [...pedidos];
    [nuevaLista[idx], nuevaLista[nuevoIdx]] = [nuevaLista[nuevoIdx], nuevaLista[idx]];
    setPedidos(nuevaLista);

    // Asignar orden_produccion = índice (0-based)
    const updates = nuevaLista.map((p, i) => ({ id: p.id, orden: i }));

    setError(undefined);
    startTransition(async () => {
      // Guardar todos los órdenes actualizados
      try {
        await Promise.all(
          updates.map(({ id, orden }) =>
            fetch("/api/admin/cola", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, orden_produccion: orden }),
            })
          )
        );
      } catch {
        setError("Error al guardar el orden. Recargá la página.");
      }
    });
  };

  const setPrioridad = async (pedidoId: string, prioridad: string) => {
    setGuardando(pedidoId);
    try {
      await fetch(`/api/pedidos/${pedidoId}/prioridad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prioridad }),
      });
      setPedidos((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, prioridad } : p))
      );
    } catch {
      setError("Error al actualizar prioridad.");
    }
    setGuardando(null);
  };

  if (pedidos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400">
        No hay pedidos activos en producción.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span>↑↓ Arrastrá para reordenar</span>
        <span>·</span>
        <span>{pedidos.length} pedidos activos</span>
        {isPending && <span className="text-amber-500 font-medium">Guardando...</span>}
      </div>

      {pedidos.map((p, idx) => {
        const items = p.items_pedido ?? [];
        const total = items.reduce((a, i) => a + (i.precio ?? 0), 0);
        const esUrgente = p.prioridad === "urgente";

        return (
          <div
            key={p.id}
            className={`bg-white rounded-xl border-2 shadow-sm flex items-stretch gap-0 overflow-hidden transition ${
              esUrgente ? "border-red-300" : "border-zinc-200"
            }`}
          >
            {/* Número de posición */}
            <div className={`flex items-center justify-center w-12 shrink-0 font-black text-lg ${
              esUrgente ? "bg-red-50 text-red-500" : "bg-zinc-50 text-zinc-300"
            }`}>
              {idx + 1}
            </div>

            {/* Contenido */}
            <div className="flex-1 px-4 py-3 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/pedidos/${p.id}`}
                      className="font-mono font-black text-[#1a1a2e] hover:text-[#f5a623] text-base transition">
                      #{parseInt(p.numero, 10)}
                    </Link>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[p.estado] ?? "bg-zinc-100 text-zinc-500"}`}>
                      {p.estado}
                    </span>
                    {esUrgente && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        🔴 URGENTE
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 mt-0.5">
                    {(p.clientes as any)?.nombre ?? "Sin cliente"}
                  </p>
                  {items.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">
                      {items.map((i) => i.producto).join(" · ")}
                    </p>
                  )}
                  {p.mensaje && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-1 inline-block">
                      💬 {p.mensaje}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-[#f5a623]">{fmt(total)}</p>
                  {p.sucursal_produccion && (
                    <p className="text-xs text-zinc-400">{p.sucursal_produccion}</p>
                  )}
                </div>
              </div>

              {/* Prioridad rápida */}
              <div className="flex gap-2 mt-2">
                {["normal", "urgente"].map((pr) => (
                  <button key={pr} type="button"
                    onClick={() => setPrioridad(p.id, pr)}
                    disabled={guardando === p.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition capitalize ${
                      p.prioridad === pr
                        ? pr === "urgente"
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : "bg-amber-100 text-amber-700 border border-amber-300"
                        : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 border border-transparent"
                    }`}>
                    {pr}
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de orden */}
            <div className="flex flex-col border-l border-zinc-100 shrink-0">
              <button
                onClick={() => mover(idx, -1)}
                disabled={idx === 0 || isPending}
                className="flex-1 px-3 flex items-center justify-center text-zinc-400 hover:text-[#1a1a2e] hover:bg-zinc-50 disabled:opacity-20 transition text-lg"
                title="Subir"
              >
                ▲
              </button>
              <div className="border-t border-zinc-100" />
              <button
                onClick={() => mover(idx, 1)}
                disabled={idx === pedidos.length - 1 || isPending}
                className="flex-1 px-3 flex items-center justify-center text-zinc-400 hover:text-[#1a1a2e] hover:bg-zinc-50 disabled:opacity-20 transition text-lg"
                title="Bajar"
              >
                ▼
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
