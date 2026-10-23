"use client";

import Link from "next/link";
import { useState } from "react";

export type AlertaProduccion = {
  id: string;
  titulo: string;
  detalle: string | null;
  creado_en: string;
  pedido: { id: string; numero: string } | null;
};

export function AlertasProduccion({ alertas: iniciales }: { alertas: AlertaProduccion[] }) {
  const [alertas, setAlertas] = useState(iniciales);
  const [open, setOpen] = useState(false);

  const marcarLeida = (id: string) => {
    setAlertas((prev) => prev.filter((alerta) => alerta.id !== id));
    void fetch(`/api/notificaciones/${id}`, { method: "PATCH" });
  };

  if (!alertas.length) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)}
        className="relative rounded-md px-2.5 py-1.5 text-xs font-black text-amber-100 hover:bg-white/10 hover:text-white transition"
        aria-expanded={open}>
        Alertas
        <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] text-white">{alertas.length}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-xl">
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="text-sm font-bold">Alertas de producción</p>
            <p className="mt-0.5 text-xs text-zinc-500">Pedidos que requieren atención.</p>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
            {alertas.map((alerta) => (
              <div key={alerta.id} className="px-4 py-3">
                <p className="text-sm font-bold text-red-700">{alerta.titulo}</p>
                {alerta.detalle && <p className="mt-1 text-xs text-zinc-600">{alerta.detalle}</p>}
                <p className="mt-1 text-[11px] text-zinc-400">{new Date(alerta.creado_en).toLocaleString("es-AR")}</p>
                <div className="mt-2 flex items-center gap-3">
                  {alerta.pedido && (
                    <Link href={`/pedidos/${alerta.pedido.id}`} onClick={() => marcarLeida(alerta.id)}
                      className="text-xs font-bold text-blue-600 hover:underline">
                      Ver pedido #{alerta.pedido.numero}
                    </Link>
                  )}
                  <button type="button" onClick={() => marcarLeida(alerta.id)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                    Marcar leída
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
