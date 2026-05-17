"use client";

import { useState, useTransition } from "react";
import { actualizarEstado } from "./actions";

const COLORES: Record<string, string> = {
  "Encargo recibido": "bg-blue-100 text-blue-700 border-blue-300",
  "En proceso": "bg-amber-100 text-amber-700 border-amber-300",
  "Listo para retirar": "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Entregado": "bg-zinc-100 text-zinc-600 border-zinc-300",
  "Cancelado": "bg-red-100 text-red-600 border-red-300",
};

export default function CambiarEstado({
  pedidoId,
  estadoActual,
  estados,
}: {
  pedidoId: string;
  estadoActual: string;
  estados: string[];
}) {
  const [estado, setEstado] = useState(estadoActual);
  const [isPending, startTransition] = useTransition();

  const handleChange = (nuevoEstado: string) => {
    setEstado(nuevoEstado);
    startTransition(() => {
      actualizarEstado(pedidoId, nuevoEstado);
    });
  };

  const clase = COLORES[estado] ?? "bg-zinc-100 text-zinc-500 border-zinc-200";

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Estado</h2>
      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border mb-3 ${clase}`}>
        {estado}
      </span>
      <select
        value={estado}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] mt-2"
      >
        {estados.map((e) => <option key={e}>{e}</option>)}
      </select>
      {isPending && <p className="text-xs text-zinc-400 mt-2">Actualizando...</p>}
    </div>
  );
}
