"use client";

import { useState, useTransition, useRef } from "react";

type Usuario = { id: string; nombre: string; rol: string };
type Registro = {
  id: string; usuario_id: string; fecha: string;
  estado: string; hora_entrada: string | null; hora_salida: string | null; notas: string | null;
};
type Semana = { desde: string; hasta: string };

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADOS = ["presente", "ausente", "licencia", "feriado"] as const;
type Estado = typeof ESTADOS[number];

const ESTADO_COLOR: Record<Estado, string> = {
  presente:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  ausente:   "bg-red-100 text-red-700 border-red-200",
  licencia:  "bg-blue-100 text-blue-700 border-blue-200",
  feriado:   "bg-zinc-100 text-zinc-500 border-zinc-200",
};
const ESTADO_ICON: Record<Estado, string> = {
  presente: "✅", ausente: "❌", licencia: "📋", feriado: "🏖️",
};

function diasDeSemana(desde: string): string[] {
  const dias: string[] = [];
  const inicio = new Date(desde + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d.toISOString().split("T")[0]);
  }
  return dias;
}

function semanaAnterior(desde: string): string {
  const d = new Date(desde + "T12:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}
function semanaSiguiente(desde: string): string {
  const d = new Date(desde + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}
function fmtFecha(fecha: string): string {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default function PresentismoClient({
  usuariosIniciales, registrosIniciales, semanaInicial,
}: {
  usuariosIniciales: Usuario[];
  registrosIniciales: Registro[];
  semanaInicial: Semana;
}) {
  const [semana, setSemana] = useState<Semana>(semanaInicial);
  const [registros, setRegistros] = useState<Registro[]>(registrosIniciales);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<{ userId: string; fecha: string } | null>(null);
  const [editEstado, setEditEstado] = useState<Estado>("presente");
  const [editHoraEntrada, setEditHoraEntrada] = useState("");
  const [editHoraSalida, setEditHoraSalida] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [savedRegistroId, setSavedRegistroId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [certUrl, setCertUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const dias = diasDeSemana(semana.desde);

  const cargarSemana = async (desde: string) => {
    setCargando(true);
    const r = await fetch(`/api/admin/asistencia?semana=${desde}`);
    const json = await r.json();
    setRegistros(json.registros ?? []);
    setSemana(json.semana);
    setCargando(false);
  };

  const getRegistro = (userId: string, fecha: string): Registro | undefined =>
    registros.find((r) => r.usuario_id === userId && r.fecha === fecha);

  const abrirEditar = (userId: string, fecha: string) => {
    const reg = getRegistro(userId, fecha);
    setEditando({ userId, fecha });
    setEditEstado((reg?.estado as Estado) ?? "presente");
    setEditHoraEntrada(reg?.hora_entrada ?? "");
    setEditHoraSalida(reg?.hora_salida ?? "");
    setEditNotas(reg?.notas ?? "");
    setSavedRegistroId(reg?.id ?? null);
    setCertUrl((reg as any)?.certificado_url ?? null);
    setError(undefined);
  };

  const subirCertificado = async (file: File) => {
    if (!savedRegistroId) return;
    setSubiendo(true);
    setError(undefined);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("asistencia_id", savedRegistroId);
    const res = await fetch("/api/admin/asistencia/certificado", { method: "POST", body: fd });
    const json = await res.json();
    setSubiendo(false);
    if (!res.ok) { setError(json.error); return; }
    setCertUrl(json.url);
    // Actualizar registro local
    setRegistros((prev) =>
      prev.map((r) => r.id === savedRegistroId ? { ...r, certificado_url: json.url } as any : r)
    );
  };

  const guardar = () => {
    if (!editando) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/admin/asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id:   editando.userId,
          fecha:        editando.fecha,
          estado:       editEstado,
          hora_entrada: editHoraEntrada || null,
          hora_salida:  editHoraSalida  || null,
          notas:        editNotas       || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      // Actualizar local
      setRegistros((prev) => {
        const filtered = prev.filter(
          (r) => !(r.usuario_id === editando.userId && r.fecha === editando.fecha)
        );
        return [...filtered, json.registro];
      });
      setSavedRegistroId(json.registro.id);
    });
  };

  const hoy = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Navegación de semana */}
      <div className="flex items-center gap-3">
        <button onClick={() => cargarSemana(semanaAnterior(semana.desde))}
          disabled={cargando}
          className="px-3 py-2 rounded-xl border-2 border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition">
          ← Semana anterior
        </button>
        <span className="text-sm font-semibold text-zinc-700">
          {fmtFecha(semana.desde)} — {fmtFecha(semana.hasta)}
        </span>
        <button onClick={() => cargarSemana(semanaSiguiente(semana.desde))}
          disabled={cargando}
          className="px-3 py-2 rounded-xl border-2 border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition">
          Semana siguiente →
        </button>
        {cargando && <span className="text-xs text-zinc-400">Cargando...</span>}
      </div>

      {/* Grilla */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 font-bold text-zinc-600 w-40">Empleado</th>
              {dias.map((fecha, i) => (
                <th key={fecha} className={`text-center px-2 py-3 font-bold text-xs ${
                  fecha === hoy ? "text-[#f5a623]" : "text-zinc-500"
                }`}>
                  <div>{DIAS[i]}</div>
                  <div className="font-normal">{fmtFecha(fecha)}</div>
                </th>
              ))}
              <th className="text-center px-3 py-3 font-bold text-zinc-500 text-xs">Pres.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {usuariosIniciales.map((u) => {
              const presencias = dias.filter((f) => {
                const r = getRegistro(u.id, f);
                return r?.estado === "presente";
              }).length;

              return (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-zinc-800">{u.nombre}</p>
                    <p className="text-xs text-zinc-400 capitalize">{u.rol}</p>
                  </td>
                  {dias.map((fecha) => {
                    const reg = getRegistro(u.id, fecha);
                    const estado = (reg?.estado as Estado) ?? null;
                    const esFuturo = fecha > hoy;

                    return (
                      <td key={fecha} className="text-center px-1 py-2">
                        <button
                          onClick={() => abrirEditar(u.id, fecha)}
                          className={`w-full py-1.5 px-1 rounded-lg border text-xs font-semibold transition hover:opacity-80 ${
                            estado
                              ? ESTADO_COLOR[estado]
                              : esFuturo
                                ? "bg-zinc-50 text-zinc-300 border-zinc-100"
                                : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:border-zinc-300"
                          }`}
                          title={estado ? `${ESTADO_ICON[estado]} ${estado}${reg?.hora_entrada ? ` · Entrada: ${reg.hora_entrada}` : ""}` : "Sin registro"}
                        >
                          {estado ? ESTADO_ICON[estado] : esFuturo ? "—" : "·"}
                          {reg?.hora_entrada && (
                            <div className="text-[9px] font-normal opacity-70">{reg.hora_entrada}</div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-center px-3 py-3 font-black text-zinc-700">
                    {presencias}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        {ESTADOS.map((e) => (
          <span key={e} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${ESTADO_COLOR[e]}`}>
            {ESTADO_ICON[e]} {e}
          </span>
        ))}
        <span className="text-zinc-400">· Hacé click en cualquier celda para editar</span>
      </div>

      {/* Modal de edición */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditando(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[420px] max-w-[95vw] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-zinc-800">Editar asistencia</h3>
              <button onClick={() => setEditando(null)}
                className="text-zinc-400 hover:text-zinc-700 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100">×</button>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-1 font-bold uppercase tracking-wide">Empleado</p>
              <p className="font-semibold text-zinc-800">
                {usuariosIniciales.find((u) => u.id === editando.userId)?.nombre}
              </p>
              <p className="text-xs text-zinc-400">{fmtFecha(editando.fecha)}</p>
            </div>

            {/* Estado */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-bold uppercase tracking-wide">Estado</p>
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS.map((e) => (
                  <button key={e} type="button" onClick={() => setEditEstado(e)}
                    className={`py-2 rounded-xl border-2 text-xs font-bold transition capitalize ${
                      editEstado === e
                        ? ESTADO_COLOR[e] + " border-current"
                        : "border-zinc-200 text-zinc-400 hover:border-zinc-300"
                    }`}>
                    {ESTADO_ICON[e]} {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Horarios */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Hora entrada</label>
                <input type="time" value={editHoraEntrada} onChange={(e) => setEditHoraEntrada(e.target.value)}
                  suppressHydrationWarning
                  className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Hora salida</label>
                <input type="time" value={editHoraSalida} onChange={(e) => setEditHoraSalida(e.target.value)}
                  suppressHydrationWarning
                  className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Notas</label>
              <input value={editNotas} onChange={(e) => setEditNotas(e.target.value)}
                suppressHydrationWarning placeholder="Ej: certificado médico presentado"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            </div>

            {/* Certificado — solo si el estado es licencia y ya se guardó el registro */}
            {editEstado === "licencia" && (
              <div className="border-t border-zinc-100 pt-3 space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Certificado médico</p>
                {certUrl ? (
                  <div className="flex items-center gap-2">
                    <a href={certUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline truncate max-w-[200px]">
                      📎 Ver certificado subido
                    </a>
                    <button onClick={() => fileRef.current?.click()}
                      className="text-xs text-zinc-400 hover:text-zinc-700 transition">Reemplazar</button>
                  </div>
                ) : savedRegistroId ? (
                  <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                    className="w-full py-2 rounded-xl border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 transition">
                    {subiendo ? "Subiendo..." : "📎 Subir certificado (foto o PDF)"}
                  </button>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Guardá el registro primero para poder subir el certificado.</p>
                )}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) subirCertificado(e.target.files[0]); }} />
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={guardar} disabled={isPending}
                className="flex-1 py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-50 transition">
                {isPending ? "Guardando..." : "✓ Guardar"}
              </button>
              {savedRegistroId && (
                <button type="button" onClick={() => setEditando(null)}
                  className="px-4 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-semibold hover:bg-zinc-200 transition">
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
