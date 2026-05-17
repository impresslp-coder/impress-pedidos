"use client";

import { useState } from "react";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  sucursal_default: string | null;
  codigo_personal: string | null;
  activo: boolean | null;
};

export default function UsuariosManager({ usuarios: inicial }: { usuarios: Usuario[] }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(inicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [vals, setVals] = useState<Partial<Usuario>>({});

  const iniciarEdicion = (u: Usuario) => {
    setEditando(u.id);
    setVals({ rol: u.rol, sucursal_default: u.sucursal_default ?? "", codigo_personal: u.codigo_personal ?? "", activo: u.activo ?? true });
  };

  const guardar = async (id: string) => {
    setSaving(id);
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...vals }),
    });
    if (res.ok) {
      setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, ...vals } as Usuario : u));
      setEditando(null);
    }
    setSaving(null);
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nombre</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Email</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Rol</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Código</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sucursal</th>
            <th className="text-left px-4 py-3 font-semibold text-zinc-600">Activo</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {usuarios.map((u) => {
            const isEdit = editando === u.id;
            return (
              <tr key={u.id} className={`transition ${isEdit ? "bg-amber-50" : "hover:bg-zinc-50"}`}>
                <td className="px-4 py-3 font-medium text-zinc-800">{u.nombre}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{u.email}</td>

                {/* Rol */}
                <td className="px-4 py-3">
                  {isEdit ? (
                    <select value={vals.rol} onChange={(e) => setVals((v) => ({ ...v, rol: e.target.value }))}
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                      <option value="operador">operador</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.rol === "admin" ? "bg-purple-100 text-purple-700" : "bg-zinc-100 text-zinc-600"
                    }`}>{u.rol}</span>
                  )}
                </td>

                {/* Código personal */}
                <td className="px-4 py-3">
                  {isEdit ? (
                    <input value={vals.codigo_personal ?? ""} suppressHydrationWarning
                      onChange={(e) => setVals((v) => ({ ...v, codigo_personal: e.target.value }))}
                      placeholder="Ej: LU01"
                      className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
                  ) : (
                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                      u.codigo_personal ? "bg-amber-50 text-amber-800 border border-amber-200" : "text-zinc-400 italic"
                    }`}>
                      {u.codigo_personal || "sin código"}
                    </span>
                  )}
                </td>

                {/* Sucursal */}
                <td className="px-4 py-3">
                  {isEdit ? (
                    <input value={vals.sucursal_default ?? ""} suppressHydrationWarning
                      onChange={(e) => setVals((v) => ({ ...v, sucursal_default: e.target.value }))}
                      placeholder="Sucursal"
                      className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
                  ) : (
                    <span className="text-zinc-500">{u.sucursal_default || "—"}</span>
                  )}
                </td>

                {/* Activo */}
                <td className="px-4 py-3">
                  {isEdit ? (
                    <input type="checkbox" checked={vals.activo ?? true} suppressHydrationWarning
                      onChange={(e) => setVals((v) => ({ ...v, activo: e.target.checked }))}
                      className="rounded accent-[#f5a623] w-4 h-4" />
                  ) : (
                    <span className={`text-xs font-medium ${u.activo ? "text-emerald-600" : "text-red-500"}`}>
                      {u.activo ? "Sí" : "No"}
                    </span>
                  )}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3">
                  {isEdit ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => guardar(u.id)} disabled={saving === u.id}
                        className="px-3 py-1 rounded-lg bg-[#f5a623] text-[#1a1a2e] text-xs font-bold hover:bg-[#d4881a] disabled:opacity-50 transition">
                        {saving === u.id ? "..." : "Guardar"}
                      </button>
                      <button onClick={() => setEditando(null)}
                        className="px-3 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-semibold hover:bg-zinc-200 transition">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => iniciarEdicion(u)}
                      className="px-3 py-1 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-semibold hover:bg-zinc-200 transition">
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
