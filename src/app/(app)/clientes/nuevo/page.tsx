"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { agregarCliente } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] disabled:opacity-60 transition"
    >
      {pending ? "Guardando..." : "Guardar cliente"}
    </button>
  );
}

export default function NuevoClientePage() {
  const router = useRouter();
  const [state, formAction] = useActionState(agregarCliente, undefined);

  useEffect(() => {
    if (state?.ok) router.push("/clientes");
  }, [state, router]);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-800 mb-6">Nuevo cliente</h1>

      <form action={formAction} className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            name="nombre"
            required
            suppressHydrationWarning
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            placeholder="Nombre completo o razón social"
          />
        </div>

        <div className="flex gap-3">
          <div className="w-28">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Cód. país</label>
            <input
              name="cod_pais"
              defaultValue="54"
              suppressHydrationWarning
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Teléfono</label>
            <input
              name="telefono"
              suppressHydrationWarning
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              placeholder="2216001234"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input
            name="mail"
            type="email"
            suppressHydrationWarning
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            placeholder="correo@ejemplo.com"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <SubmitButton />
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 rounded-lg bg-zinc-100 text-zinc-700 font-medium text-sm hover:bg-zinc-200 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
