"use client";

import { useRef, useState, useTransition } from "react";
import { marcarArchivoImpreso } from "./actions";

type Archivo = Record<string, any>;
type Pedido = Record<string, any>;

export default function PrintViewer({
  pedido,
  archivo,
  pdfUrl,
}: {
  pedido: Pedido;
  archivo: Archivo;
  pdfUrl: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>();

  const imprimir = () => {
    setMsg(undefined);
    frameRef.current?.contentWindow?.focus();
    frameRef.current?.contentWindow?.print();
    startTransition(async () => {
      const res = await marcarArchivoImpreso(pedido.id, archivo.id);
      setMsg(res?.error ? res.error : "Marcado como enviado a impresion");
    });
  };

  return (
    <div className="h-screen bg-zinc-950 text-white grid grid-cols-[1fr_360px]">
      <main className="min-w-0 bg-zinc-900">
        <iframe
          ref={frameRef}
          src={pdfUrl}
          title={archivo.nombre_archivo}
          className="w-full h-full border-0 bg-white"
        />
      </main>

      <aside className="border-l border-white/10 bg-[#1a1a2e] p-5 flex flex-col gap-5 overflow-y-auto">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide">IMPRESS Print</p>
          <h1 className="text-xl font-black text-[#f5a623] leading-tight mt-1">
            Revisar e imprimir
          </h1>
        </div>

        <section className="rounded-lg bg-white/8 border border-white/10 p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Archivo</p>
          <p className="font-bold text-sm break-words">{archivo.nombre_archivo}</p>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex mt-3 text-xs text-[#f5a623] hover:underline">
            Abrir PDF en pestana
          </a>
        </section>

        <section className="rounded-lg bg-white text-zinc-900 p-4 space-y-3">
          <h2 className="font-black text-sm uppercase tracking-wide">Configuracion solicitada</h2>
          <Info label="Copias" value={String(archivo.copias ?? 1)} />
          <Info label="Color" value={archivo.color ? "Color" : "Blanco y negro"} />
          <Info label="Faz" value={archivo.doble_faz ? "Doble faz" : "Simple faz"} />
          <Info label="Papel" value={archivo.tamano_papel ?? "A4"} />
          <Info label="Orientacion" value={archivo.orientacion ?? "-"} />
          <Info label="Paginas por hoja" value={String(archivo.paginas_por_hoja ?? 1)} />
          <Info label="Rango" value={archivo.rango_paginas || "Todas"} />
        </section>

        <section className="rounded-lg bg-white/8 border border-white/10 p-4 space-y-2">
          <p className="text-xs text-zinc-400 uppercase tracking-wide">Pedido</p>
          <InfoDark label="Numero" value={pedido.numero} />
          <InfoDark label="Cliente" value={pedido.clientes?.nombre ?? "-"} />
          <InfoDark label="Estado" value={archivo.estado ?? pedido.estado ?? "-"} />
        </section>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-xs ${msg.includes("impresion") ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
            {msg}
          </p>
        )}

        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={imprimir}
            disabled={isPending}
            className="w-full py-3 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-50 transition">
            {isPending ? "Marcando..." : "Aceptar / Imprimir"}
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="w-full py-2 rounded-lg bg-white/10 text-zinc-200 font-semibold text-sm hover:bg-white/15 transition">
            Cerrar
          </button>
        </div>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="font-black text-right text-sm">{value}</span>
    </div>
  );
}

function InfoDark({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
}
