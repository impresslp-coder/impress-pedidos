"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registrarReclamo } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition">
      {pending ? "Guardando..." : "Registrar reclamo"}
    </button>
  );
}

export default function ReclamoForm() {
  const [state, formAction] = useActionState(registrarReclamo, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Nro de pedido <span className="text-red-500">*</span>
        </label>
        <input
          name="pedido_numero"
          required
          suppressHydrationWarning
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          placeholder="0000001"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Sucursal</label>
        <input
          name="sucursal"
          suppressHydrationWarning
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Descripción del reclamo <span className="text-red-500">*</span>
        </label>
        <textarea
          name="texto"
          required
          rows={3}
          suppressHydrationWarning
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          placeholder="Describí el problema..."
        />
      </div>

      {state?.error && (
        <div className="sm:col-span-2">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        </div>
      )}
      {state?.ok && (
        <div className="sm:col-span-2">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ Reclamo #{state.numero} registrado
          </p>
        </div>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
