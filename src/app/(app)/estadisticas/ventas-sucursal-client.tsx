"use client";

import { useState } from "react";

type VentaDetalle = {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  sucursal: string;
  items: Array<{ nombre: string; cantidad: number; total: number; tipo: "impresion" | "producto" }>;
};

type SucursalStats = {
  sucursal: string;
  ventas: number;
  total: number;
  impresion: number;
  productos: number;
  detalles: VentaDetalle[];
};

function money(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export function VentasSucursalClient({ stats }: { stats: SucursalStats[] }) {
  const [selected, setSelected] = useState<SucursalStats | null>(null);

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-xl font-black text-brand">Ventas por sucursal</h2>
          <p className="text-sm text-zinc-500">Tocá una sucursal para ver el detalle del intervalo.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3">Sucursal</th>
                <th className="px-5 py-3 text-right">Ventas</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Impresion</th>
                <th className="px-5 py-3 text-right">Productos sistema</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr
                  key={row.sucursal}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-t border-zinc-100 hover:bg-amber-50"
                >
                  <td className="px-5 py-4 text-lg font-black text-brand">{row.sucursal}</td>
                  <td className="px-5 py-4 text-right font-bold">{row.ventas}</td>
                  <td className="px-5 py-4 text-right text-lg font-black text-brand">{money(row.total)}</td>
                  <td className="px-5 py-4 text-right font-bold text-zinc-700">{money(row.impresion)}</td>
                  <td className="px-5 py-4 text-right font-bold text-zinc-700">{money(row.productos)}</td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                    No hay ventas en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-black text-brand">Detalle {selected.sucursal}</h2>
                <p className="text-sm text-zinc-500">
                  {selected.ventas} ventas · {money(selected.total)}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-2xl font-black text-zinc-400 hover:text-zinc-700">
                X
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-6">
              <div className="space-y-3">
                {selected.detalles.map((venta) => (
                  <div key={venta.id} className="rounded-lg border border-zinc-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-lg font-black text-brand">{venta.numero}</p>
                        <p className="text-sm text-zinc-500">{dateTime(venta.fecha)}</p>
                      </div>
                      <p className="text-xl font-black text-brand">{money(venta.total)}</p>
                    </div>
                    <div className="mt-3 divide-y divide-zinc-100">
                      {venta.items.map((item, index) => (
                        <div key={`${venta.id}-${index}`} className="grid grid-cols-[1fr_80px_120px_120px] gap-3 py-2 text-sm">
                          <span className="font-semibold text-zinc-700">{item.nombre}</span>
                          <span className="text-right text-zinc-500">x{item.cantidad}</span>
                          <span className={item.tipo === "impresion" ? "font-bold text-sky-700" : "font-bold text-emerald-700"}>
                            {item.tipo === "impresion" ? "Impresion" : "Producto"}
                          </span>
                          <span className="text-right font-black text-brand">{money(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
