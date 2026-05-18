"use client";

import { useState, useTransition } from "react";
import { registrarMovimientoCaja } from "./caja-actions";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20] as const;

export function RetiroEfectivoButton() {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [billetes, setBilletes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setCodigo("");
    setBilletes({});
    setMessage("");
    setError("");
  }

  function submit() {
    setError("");
    setMessage("");
    const payload = Object.fromEntries(
      DENOMINACIONES.map((denominacion) => [String(denominacion), Number(billetes[String(denominacion)]) || 0]),
    );

    startTransition(async () => {
      const result = await registrarMovimientoCaja("retiro", payload, codigo);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Retiro registrado correctamente.");
      setTimeout(close, 900);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#f5a623] px-4 py-3 font-black text-brand hover:brightness-95"
      >
        Retiro de efectivo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <h2 className="text-2xl font-black text-brand">Retiro de efectivo</h2>
                <p className="text-sm text-zinc-500">Cargá la cantidad de billetes retirados de la caja.</p>
              </div>
              <button type="button" onClick={close} className="text-2xl font-black text-zinc-400 hover:text-zinc-700">
                X
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-3">
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
                <button type="button" onClick={close} className="rounded-lg bg-zinc-200 px-5 py-3 font-black text-brand hover:bg-zinc-300">
                  Cancelar
                </button>
                <button type="button" onClick={submit} disabled={isPending} className="rounded-lg bg-[#f5a623] px-5 py-3 font-black text-brand hover:brightness-95 disabled:opacity-60">
                  {isPending ? "Guardando..." : "Guardar retiro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
