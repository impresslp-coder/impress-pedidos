"use client";

import { useState, useTransition } from "react";
import { registrarGastoCaja, registrarMovimientoCaja } from "./estadisticas/caja-actions";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20] as const;
const MEDIOS_PAGO = ["efectivo", "transferencia", "mercado pago", "tarjeta"] as const;

type TipoCaja = "inicio" | "cierre";
type GastoRow = { concepto: string; valor: string; medio_pago: string };

export function CajaMenu({ userName }: { userName: string }) {
  const [openMenu, setOpenMenu] = useState(false);
  const [modal, setModal] = useState<TipoCaja | null>(null);
  const [gastoOpen, setGastoOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [billetes, setBilletes] = useState<Record<string, string>>({});
  const [gastos, setGastos] = useState<GastoRow[]>([{ concepto: "", valor: "", medio_pago: "efectivo" }]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const title = modal === "inicio" ? "Inicio de caja" : "Cerrar jornada";

  function resetModal(nextModal: TipoCaja | null) {
    setModal(nextModal);
    setCodigo("");
    setBilletes({});
    setError("");
    setMessage("");
  }

  function resetGasto(open: boolean) {
    setGastoOpen(open);
    setCodigo("");
    setGastos([{ concepto: "", valor: "", medio_pago: "efectivo" }]);
    setError("");
    setMessage("");
  }

  function submit() {
    if (!modal) return;
    setError("");
    setMessage("");
    const payload = Object.fromEntries(
      DENOMINACIONES.map((denominacion) => [String(denominacion), Number(billetes[String(denominacion)]) || 0]),
    );

    startTransition(async () => {
      const result = await registrarMovimientoCaja(modal, payload, codigo);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Registro guardado correctamente.");
      setTimeout(() => resetModal(null), 900);
    });
  }

  function submitGasto() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await registrarGastoCaja(
        gastos.map((gasto) => ({ ...gasto, valor: Number(gasto.valor) || 0 })),
        codigo,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Gasto registrado correctamente.");
      setTimeout(() => resetGasto(false), 900);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        className="px-2 py-1 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition"
      >
        {userName}
      </button>

      {openMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/10 bg-zinc-950 p-2 shadow-xl z-40">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              resetModal("inicio");
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-black text-white hover:bg-white/10"
          >
            Inicio de caja
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              resetModal("cierre");
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-black text-white hover:bg-white/10"
          >
            Cerrar jornada
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenMenu(false);
              resetGasto(true);
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm font-black text-white hover:bg-white/10"
          >
            Declarar gasto
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-black text-brand">{title}</h2>
                <p className="text-sm text-zinc-500">Cargá la cantidad de billetes por denominación.</p>
              </div>
              <button
                type="button"
                onClick={() => resetModal(null)}
                className="text-2xl font-black text-zinc-400 hover:text-zinc-700"
              >
                X
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 py-5">
              {DENOMINACIONES.map((denominacion) => (
                <label key={denominacion} className="block">
                  <span className="block text-xs font-black uppercase text-zinc-500">
                    $ {denominacion.toLocaleString("es-AR")}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={billetes[String(denominacion)] ?? ""}
                    onChange={(e) => setBilletes((v) => ({ ...v, [String(denominacion)]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-black text-brand outline-none focus:border-[#f5a623]"
                    placeholder="0"
                    suppressHydrationWarning
                  />
                </label>
              ))}
            </div>

            <div className="border-t border-zinc-200 px-6 py-4">
              <label className="ml-auto block max-w-xs">
                <span className="block text-xs font-black uppercase text-zinc-500">Codigo de usuario</span>
                <input
                  type="password"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 font-black text-brand outline-none focus:border-[#f5a623]"
                  suppressHydrationWarning
                />
              </label>

              {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
              {message && <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => resetModal(null)}
                  className="rounded-lg bg-zinc-200 px-5 py-3 font-black text-brand hover:bg-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending}
                  className="rounded-lg bg-[#f5a623] px-5 py-3 font-black text-brand hover:brightness-95 disabled:opacity-60"
                >
                  {isPending ? "Guardando..." : "Guardar registro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gastoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-black text-brand">Declarar gasto</h2>
                <p className="text-sm text-zinc-500">Cargá uno o varios gastos de la jornada.</p>
              </div>
              <button type="button" onClick={() => resetGasto(false)} className="text-2xl font-black text-zinc-400 hover:text-zinc-700">
                X
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              {gastos.map((gasto, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_190px]">
                  <label>
                    <span className="block text-xs font-black uppercase text-zinc-500">Gasto</span>
                    <input
                      value={gasto.concepto}
                      onChange={(e) => setGastos((rows) => rows.map((row, i) => i === index ? { ...row, concepto: e.target.value } : row))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 font-black text-brand outline-none focus:border-[#f5a623]"
                      placeholder="Ej: limpieza, cadeteria..."
                      suppressHydrationWarning
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-black uppercase text-zinc-500">Valor</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={gasto.valor}
                      onChange={(e) => setGastos((rows) => rows.map((row, i) => i === index ? { ...row, valor: e.target.value } : row))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 font-black text-brand outline-none focus:border-[#f5a623]"
                      placeholder="0"
                      suppressHydrationWarning
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-black uppercase text-zinc-500">Medio de pago</span>
                    <select
                      value={gasto.medio_pago}
                      onChange={(e) => setGastos((rows) => rows.map((row, i) => i === index ? { ...row, medio_pago: e.target.value } : row))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 font-black text-brand outline-none focus:border-[#f5a623]"
                    >
                      {MEDIOS_PAGO.map((medio) => <option key={medio} value={medio}>{medio}</option>)}
                    </select>
                  </label>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setGastos((rows) => [...rows, { concepto: "", valor: "", medio_pago: "efectivo" }])}
                className="rounded-lg border border-[#f5a623] px-4 py-2 text-sm font-black text-brand hover:bg-amber-50"
              >
                Agregar fila
              </button>
            </div>

            <div className="border-t border-zinc-200 px-6 py-4">
              <label className="ml-auto block max-w-xs">
                <span className="block text-xs font-black uppercase text-zinc-500">Codigo de usuario</span>
                <input
                  type="password"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 font-black text-brand outline-none focus:border-[#f5a623]"
                  suppressHydrationWarning
                />
              </label>

              {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
              {message && <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => resetGasto(false)} className="rounded-lg bg-zinc-200 px-5 py-3 font-black text-brand hover:bg-zinc-300">
                  Cancelar
                </button>
                <button type="button" onClick={submitGasto} disabled={isPending} className="rounded-lg bg-[#f5a623] px-5 py-3 font-black text-brand hover:brightness-95 disabled:opacity-60">
                  {isPending ? "Guardando..." : "Aceptar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
