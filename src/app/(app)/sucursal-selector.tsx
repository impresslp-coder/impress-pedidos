"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "impress_sucursal_activa";

export function getSucursalActiva(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setSucursalActiva(nombre: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, nombre);
}

type Sucursal = { id: string; nombre: string };

export default function SucursalSelector() {
  const [mostrar, setMostrar] = useState(false);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActual, setSucursalActual] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const guardada = localStorage.getItem(STORAGE_KEY) ?? "";
    setSucursalActual(guardada);

    // Auto-registro de entrada del día (presentismo)
    fetch("/api/admin/asistencia", { method: "PATCH" }).catch(() => {});

    fetch("/api/admin/sucursales")
      .then((r) => r.json())
      .then((json) => {
        const lista: Sucursal[] = json.sucursales ?? [];
        setSucursales(lista);
        // Si no hay sucursal guardada (o la guardada ya no existe) → mostrar modal
        const existe = lista.some((s) => s.nombre === guardada);
        if (!guardada || !existe) setMostrar(true);
      })
      .catch(() => {
        // Si falla la API, igual permitir selección manual
        if (!guardada) setMostrar(true);
      })
      .finally(() => setCargando(false));
  }, []);

  const seleccionar = (nombre: string) => {
    localStorage.setItem(STORAGE_KEY, nombre);
    setSucursalActual(nombre);
    setMostrar(false);
    // Disparar evento para que otros componentes se actualicen
    window.dispatchEvent(new CustomEvent("sucursal-changed", { detail: nombre }));
  };

  // Indicador de sucursal activa en la barra (siempre visible si hay una seleccionada)
  const indicador = sucursalActual && !cargando ? (
    <button
      onClick={() => setMostrar(true)}
      className="text-xs text-zinc-300 hover:text-white transition flex items-center gap-1"
      title="Cambiar sucursal"
    >
      <span>📍</span>
      <span className="font-semibold">{sucursalActual}</span>
    </button>
  ) : null;

  if (!mostrar) return <>{indicador}</>;

  return (
    <>
      {/* Indicador */}
      {indicador}

      {/* Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-[420px] max-w-[95vw] space-y-6 border border-zinc-100">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#1a1a2e] flex items-center justify-center mx-auto">
              <span className="text-3xl">📍</span>
            </div>
            <h2 className="text-xl font-black text-zinc-800">¿En qué sucursal estás?</h2>
            <p className="text-sm text-zinc-500">
              Esto registra en qué sucursal operás para que ventas y pedidos queden bien asignados.
            </p>
          </div>

          {/* Opciones */}
          {cargando ? (
            <p className="text-center text-sm text-zinc-400">Cargando sucursales...</p>
          ) : sucursales.length > 0 ? (
            <div className="grid gap-3">
              {sucursales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => seleccionar(s.nombre)}
                  className="w-full py-4 rounded-xl border-2 border-zinc-200 text-sm font-bold text-zinc-800 hover:border-[#f5a623] hover:bg-amber-50 hover:text-[#1a1a2e] transition"
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          ) : (
            // Fallback: input manual si no hay sucursales cargadas en DB
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 text-center">
                No hay sucursales configuradas. Escribí el nombre de tu sucursal.
              </p>
              <input
                type="text"
                placeholder="Nombre de sucursal"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) seleccionar(val);
                  }
                }}
                suppressHydrationWarning
                autoFocus
              />
              <p className="text-xs text-zinc-400 text-center">Presioná Enter para confirmar</p>
            </div>
          )}

          {/* Si hay sucursal previa, permitir cancelar */}
          {sucursalActual && (
            <button
              onClick={() => setMostrar(false)}
              className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-600 transition"
            >
              Mantener "{sucursalActual}"
            </button>
          )}
        </div>
      </div>
    </>
  );
}
