"use client";

import { useState, useEffect, useTransition } from "react";

type Impresora = { id: string; nombre: string; modelo: string | null; sucursal: string | null; activo: boolean };
type RegistroCiclos = {
  id: string; impresora_id: string; fecha: string;
  ciclos_dia: number; nivel_toner: string | null; observaciones: string | null;
};

const NIVELES = ["lleno", "medio", "bajo", "vacio"] as const;
type Nivel = typeof NIVELES[number];
const NIVEL_COLOR: Record<Nivel, string> = {
  lleno: "text-emerald-600", medio: "text-amber-500", bajo: "text-orange-600", vacio: "text-red-600",
};
const NIVEL_ICON: Record<Nivel, string> = {
  lleno: "🟢", medio: "🟡", bajo: "🟠", vacio: "🔴",
};

export default function ImpresorasPage() {
  const [impresoras, setImpresoras]       = useState<Impresora[]>([]);
  const [registrosHoy, setRegistrosHoy]   = useState<RegistroCiclos[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [editando, setEditando]           = useState<Impresora | null>(null);
  const [ciclos, setCiclos]               = useState("");
  const [nivel, setNivel]                 = useState<Nivel | "">("");
  const [obs, setObs]                     = useState("");
  const [isPending, startTransition]      = useTransition();
  const [error, setError]                 = useState<string>();

  // Nueva impresora
  const [nuevaNombre, setNuevaNombre]     = useState("");
  const [nuevoModelo, setNuevoModelo]     = useState("");
  const [nuevaSucursal, setNuevaSucursal] = useState("");
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  const [mostrarNueva, setMostrarNueva]   = useState(false);

  const cargar = () => {
    setCargando(true);
    fetch("/api/admin/impresoras")
      .then((r) => r.json())
      .then((json) => {
        setImpresoras(json.impresoras ?? []);
        setRegistrosHoy(json.registros_hoy ?? []);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const getRegistro = (id: string) => registrosHoy.find((r) => r.impresora_id === id);

  const abrirEditar = (imp: Impresora) => {
    const reg = getRegistro(imp.id);
    setEditando(imp);
    setCiclos(reg ? String(reg.ciclos_dia) : "");
    setNivel((reg?.nivel_toner as Nivel) ?? "");
    setObs(reg?.observaciones ?? "");
  };

  const guardar = () => {
    if (!editando) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/admin/impresoras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impresora_id: editando.id, ciclos_dia: ciclos, nivel_toner: nivel || null, observaciones: obs || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setRegistrosHoy((prev) => {
        const filtered = prev.filter((r) => r.impresora_id !== editando.id);
        return [...filtered, json.registro];
      });
      setEditando(null);
    });
  };

  const crearImpresora = async () => {
    if (!nuevaNombre.trim()) return;
    setGuardandoNueva(true);
    const res = await fetch("/api/admin/impresoras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevaNombre, modelo: nuevoModelo || null, sucursal: nuevaSucursal || null }),
    });
    const json = await res.json();
    if (json.impresora) setImpresoras((prev) => [...prev, json.impresora]);
    setNuevaNombre(""); setNuevoModelo(""); setNuevaSucursal("");
    setMostrarNueva(false); setGuardandoNueva(false);
  };

  const hoy = new Date().toLocaleDateString("es-AR");

  if (cargando) return <div className="text-zinc-400 py-12 text-center">Cargando impresoras...</div>;

  // Agrupar por sucursal
  const sucursales = [...new Set(impresoras.map((i) => i.sucursal ?? "Sin sucursal"))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Impresoras</h1>
          <p className="text-sm text-zinc-500 mt-1">Registro diario de ciclos y estado de tóner · {hoy}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-zinc-700 text-white text-sm font-bold hover:bg-zinc-800 transition">
            🖨️ Imprimir hoja de ciclos
          </button>
          <button onClick={() => setMostrarNueva(true)}
            className="px-4 py-2 rounded-xl bg-[#f5a623] text-[#1a1a2e] text-sm font-bold hover:bg-amber-400 transition">
            + Nueva impresora
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {impresoras.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-400">
          No hay impresoras cargadas. Agregá la primera.
        </div>
      ) : (
        sucursales.map((suc) => {
          const imps = impresoras.filter((i) => (i.sucursal ?? "Sin sucursal") === suc);
          return (
            <div key={suc} className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{suc}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imps.map((imp) => {
                  const reg = getRegistro(imp.id);
                  const nv = reg?.nivel_toner as Nivel | null;
                  return (
                    <div key={imp.id}
                      className={`bg-white rounded-xl border-2 p-4 space-y-3 ${
                        nv === "vacio" ? "border-red-300" : nv === "bajo" ? "border-orange-200" : "border-zinc-200"
                      }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-zinc-800">{imp.nombre}</p>
                          {imp.modelo && <p className="text-xs text-zinc-400">{imp.modelo}</p>}
                        </div>
                        {nv && (
                          <span className={`text-lg ${NIVEL_COLOR[nv]}`} title={`Tóner: ${nv}`}>
                            {NIVEL_ICON[nv]}
                          </span>
                        )}
                      </div>

                      {reg ? (
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between text-zinc-700">
                            <span>Ciclos hoy:</span>
                            <span className="font-black text-[#1a1a2e]">{reg.ciclos_dia.toLocaleString("es-AR")}</span>
                          </div>
                          {reg.nivel_toner && (
                            <div className="flex justify-between text-zinc-600">
                              <span>Tóner:</span>
                              <span className={`font-semibold capitalize ${NIVEL_COLOR[reg.nivel_toner as Nivel]}`}>
                                {reg.nivel_toner}
                              </span>
                            </div>
                          )}
                          {reg.observaciones && (
                            <p className="text-xs text-zinc-500 bg-zinc-50 rounded-lg px-2 py-1">{reg.observaciones}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">Sin registro hoy</p>
                      )}

                      <button onClick={() => abrirEditar(imp)}
                        className="w-full py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 transition">
                        {reg ? "✏️ Actualizar registro" : "📝 Registrar ciclos"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Modal registro */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditando(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-w-[95vw] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-zinc-800">Registrar ciclos — {editando.nombre}</h3>
              <button onClick={() => setEditando(null)}
                className="text-zinc-400 hover:text-zinc-700 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100">×</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Ciclos del día</label>
              <input type="number" min="0" value={ciclos} onChange={(e) => setCiclos(e.target.value)}
                suppressHydrationWarning autoFocus
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-xl font-black text-center focus:outline-none focus:border-[#f5a623]" />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Nivel de tóner</label>
              <div className="grid grid-cols-4 gap-2">
                {NIVELES.map((n) => (
                  <button key={n} type="button" onClick={() => setNivel(n)}
                    className={`py-2 rounded-xl border-2 text-xs font-bold transition capitalize ${
                      nivel === n
                        ? `${NIVEL_COLOR[n]} border-current bg-zinc-50`
                        : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                    }`}>
                    {NIVEL_ICON[n]}<br />{n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Observaciones</label>
              <input value={obs} onChange={(e) => setObs(e.target.value)} suppressHydrationWarning
                placeholder="Ej: papel atascado, error de rodillo..."
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            </div>

            <button type="button" onClick={guardar} disabled={isPending || !ciclos}
              className="w-full py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-50 transition">
              {isPending ? "Guardando..." : "✓ Guardar registro"}
            </button>
          </div>
        </div>
      )}

      {/* Modal nueva impresora */}
      {mostrarNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMostrarNueva(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[380px] max-w-[95vw] space-y-4">
            <h3 className="font-black text-zinc-800">Nueva impresora</h3>
            <input value={nuevaNombre} onChange={(e) => setNuevaNombre(e.target.value)}
              suppressHydrationWarning placeholder="Nombre *" autoFocus
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            <input value={nuevoModelo} onChange={(e) => setNuevoModelo(e.target.value)}
              suppressHydrationWarning placeholder="Modelo (opcional)"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            <input value={nuevaSucursal} onChange={(e) => setNuevaSucursal(e.target.value)}
              suppressHydrationWarning placeholder="Sucursal (opcional)"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            <div className="flex gap-2">
              <button onClick={crearImpresora} disabled={!nuevaNombre.trim() || guardandoNueva}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a2e] text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-50 transition">
                {guardandoNueva ? "..." : "Crear"}
              </button>
              <button onClick={() => setMostrarNueva(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-sm hover:bg-zinc-200 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
