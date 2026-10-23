"use client";

import { useState } from "react";

type Plantilla = { codigo: "retiro" | "envio"; nombre: string; cuerpo: string; activo: boolean };
const MARCADORES = ["{{nombre}}", "{{pedido_listo}}", "{{pedido_listo_retiro}}", "{{detalle}}", "{{sucursal_nombre}}", "{{sucursal_direccion}}", "{{sucursal_horario}}"];

export default function PlantillasMensajeClient({ plantillas }: { plantillas: Plantilla[] }) {
  const [rows, setRows] = useState(plantillas);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const actualizar = (codigo: string, patch: Partial<Plantilla>) => setRows((prev) => prev.map((row) => row.codigo === codigo ? { ...row, ...patch } : row));
  const guardar = async (plantilla: Plantilla) => {
    setGuardando(plantilla.codigo);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/plantillas-mensaje", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plantilla) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "No pude guardar la plantilla");
      setMensaje(`Plantilla “${plantilla.nombre}” guardada.`);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No pude guardar la plantilla");
    } finally {
      setGuardando(null);
    }
  };
  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Marcadores disponibles: {MARCADORES.join(", ")}. La aplicación reemplaza cada marcador al abrir WhatsApp.</p>
      {rows.map((plantilla) => (
        <section key={plantilla.codigo} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold text-zinc-800">{plantilla.nombre}</h2><p className="text-xs text-zinc-500">{plantilla.codigo === "retiro" ? "Para retiro en sucursal" : "Para envío a domicilio"}</p></div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700"><input type="checkbox" checked={plantilla.activo} onChange={(event) => actualizar(plantilla.codigo, { activo: event.target.checked })} />Activa</label>
          </div>
          <textarea value={plantilla.cuerpo} onChange={(event) => actualizar(plantilla.codigo, { cuerpo: event.target.value })} rows={7} className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
          <div className="flex justify-end"><button type="button" onClick={() => guardar(plantilla)} disabled={guardando === plantilla.codigo} className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50">{guardando === plantilla.codigo ? "Guardando..." : "Guardar plantilla"}</button></div>
        </section>
      ))}
      {mensaje && <p className={`rounded-lg px-3 py-2 text-sm ${mensaje.includes("guardada") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{mensaje}</p>}
    </div>
  );
}
