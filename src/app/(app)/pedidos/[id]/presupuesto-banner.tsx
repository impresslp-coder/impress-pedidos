"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertirEnPedido } from "./actions";

export default function PresupuestoBanner({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const handleConvertir = () => {
    setError(undefined);
    startTransition(async () => {
      const res = await convertirEnPedido(pedidoId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📄</span>
        <div>
          <p className="font-bold text-blue-800 text-sm">Este es un presupuesto</p>
          <p className="text-blue-600 text-xs mt-0.5">
            Cuando el cliente confirme, convertilo en pedido para que entre al flujo de producción.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <button
          type="button"
          onClick={handleConvertir}
          disabled={isPending}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition whitespace-nowrap"
        >
          {isPending ? "Convirtiendo..." : "✓ Convertir en pedido"}
        </button>
      </div>
    </div>
  );
}
