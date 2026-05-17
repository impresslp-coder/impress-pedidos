"use client";

import { useState, useRef, useCallback } from "react";

function uploadXHR(uploadUrl: string, file: File, onProgress: (pct: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red")));
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.send(file);
  });
}

type Archivo = {
  id: string;
  nombre_archivo: string;
  google_file_id: string;
  copias: number;
  color: boolean;
  doble_faz: boolean;
  tamano_papel: string;
  orientacion: string;
  paginas_por_hoja: number;
  rango_paginas: string | null;
  impreso: boolean;
};

type Prefs = {
  copias: number;
  color: boolean;
  doble_faz: boolean;
  tamano_papel: string;
  orientacion: string;
  paginas_por_hoja: number;
  rango_paginas: string;
};

const PAPELES = ["A4", "A3", "Letter", "Oficio"];

export default function ArchivosPanel({
  pedidoId,
  archivosIniciales,
}: {
  pedidoId: string;
  archivosIniciales: Archivo[];
}) {
  const [archivos, setArchivos] = useState<Archivo[]>(archivosIniciales);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [viendoId, setViendoId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    try {
      const initRes = await fetch("/api/archivos/init-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, pedidoId, mimeType: "application/pdf" }),
      });
      const { uploadUrl } = await initRes.json();
      const driveData = await uploadXHR(uploadUrl, file, setUploadPct);
      if (!driveData?.id) throw new Error("Sin fileId");
      const regRes = await fetch("/api/archivos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, fileName: file.name, googleFileId: driveData.id }),
      });
      const json = await regRes.json();
      if (json.archivo) setArchivos((prev) => [...prev, json.archivo]);
    } catch (err) {
      console.error("[upload panel]", err);
    }
    setUploading(false);
    setUploadPct(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const guardarPrefs = async (id: string, prefs: Partial<Prefs>) => {
    setSaving(id);
    await fetch("/api/archivos/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...prefs }),
    });
    setArchivos((prev) => prev.map((a) => (a.id === id ? { ...a, ...prefs } : a)));
    setSaving(null);
  };

  const imprimir = useCallback(async (archivo: Archivo) => {
    setPrinting(archivo.id);
    const res = await fetch(`/api/archivos/${archivo.google_file_id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 2000);
    };
    await fetch("/api/archivos/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: archivo.id, impreso: true }),
    });
    setArchivos((prev) => prev.map((a) => (a.id === archivo.id ? { ...a, impreso: true } : a)));
    setPrinting(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">
          Archivos para imprimir
        </h2>
        <label className="cursor-pointer">
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={handleUpload} disabled={uploading} suppressHydrationWarning />
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition min-w-[100px] justify-center
            ${uploading ? "bg-zinc-100 text-zinc-600 cursor-not-allowed" : "bg-[#1a1a2e] text-white hover:bg-[#16213e]"}`}>
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-20 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <span className="h-full bg-[#f5a623] block rounded-full transition-all"
                    style={{ width: `${uploadPct}%` }} />
                </span>
                <span>{uploadPct}%</span>
              </span>
            ) : "+ Subir PDF"}
          </span>
        </label>
      </div>

      {archivos.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-6 border border-dashed border-zinc-200 rounded-xl">
          Sin archivos adjuntos
        </p>
      )}

      <div className="space-y-3">
        {archivos.map((archivo) => (
          <div key={archivo.id} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{archivo.nombre_archivo}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {archivo.copias} cop. · {archivo.color ? "Color" : "B&N"} · {archivo.doble_faz ? "Doble faz" : "Simple"} · {archivo.tamano_papel}
                  {archivo.impreso && <span className="ml-2 text-emerald-500 font-medium">✓ Impreso</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setViendoId(viendoId === archivo.id ? null : archivo.id)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition font-medium">
                  {viendoId === archivo.id ? "Cerrar" : "Prefs"}
                </button>
                <button onClick={() => imprimir(archivo)} disabled={printing === archivo.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold hover:bg-[#d4881a] disabled:opacity-50 transition">
                  {printing === archivo.id ? "..." : "🖨️ Imprimir"}
                </button>
              </div>
            </div>

            {viendoId === archivo.id && (
              <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 space-y-4">
                {saving === archivo.id && (
                  <p className="text-xs text-zinc-400">Guardando...</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Copias</label>
                    <input type="number" min="1" defaultValue={archivo.copias} suppressHydrationWarning
                      onBlur={(e) => guardarPrefs(archivo.id, { copias: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Papel</label>
                    <select defaultValue={archivo.tamano_papel}
                      onChange={(e) => guardarPrefs(archivo.id, { tamano_papel: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                      {PAPELES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Páginas/hoja</label>
                    <select defaultValue={archivo.paginas_por_hoja}
                      onChange={(e) => guardarPrefs(archivo.id, { paginas_por_hoja: parseInt(e.target.value) })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={4}>4</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Rango (ej: 1-5,8)</label>
                    <input type="text" defaultValue={archivo.rango_paginas ?? ""} suppressHydrationWarning
                      placeholder="Todas"
                      onBlur={(e) => guardarPrefs(archivo.id, { rango_paginas: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" defaultChecked={archivo.color} suppressHydrationWarning
                      onChange={(e) => guardarPrefs(archivo.id, { color: e.target.checked })}
                      className="rounded accent-[#f5a623]" />
                    Color
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" defaultChecked={archivo.doble_faz} suppressHydrationWarning
                      onChange={(e) => guardarPrefs(archivo.id, { doble_faz: e.target.checked })}
                      className="rounded accent-[#f5a623]" />
                    Doble faz
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
