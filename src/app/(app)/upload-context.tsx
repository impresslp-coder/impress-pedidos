"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type FileProgress = {
  fileName: string;
  loaded: number;
  total: number;
  speed: number;
  done: boolean;
  error: boolean;
  errorMsg?: string;
};

type UploadSession = {
  files: FileProgress[];
  finished: boolean;
};

type UploadEntry = {
  file: File;
  pedidoId: string;
};

type UploadContextType = {
  startUploads: (entries: UploadEntry[]) => void;
};

const UploadContext = createContext<UploadContextType>({ startUploads: () => {} });

export function useUpload() {
  return useContext(UploadContext);
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Upload via our own Next.js server (no CORS issues)
function uploadViaServer(
  file: File,
  pedidoId: string,
  onProgress: (loaded: number, total: number, speed: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pedido_id", pedidoId);

    const xhr = new XMLHttpRequest();
    let startTime = Date.now();
    let lastLoaded = 0;

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      if (elapsed > 0.2) {
        const speed = (e.loaded - lastLoaded) / elapsed;
        lastLoaded = e.loaded;
        startTime = now;
        onProgress(e.loaded, e.total, speed);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Error de red")));
    xhr.open("POST", "/api/archivos/upload");
    xhr.send(formData);
  });
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UploadSession | null>(null);
  const [minimized, setMinimized] = useState(false);

  const startUploads = useCallback(async (entries: UploadEntry[]) => {
    if (!entries.length) return;

    const initialFiles: FileProgress[] = entries.map((e) => ({
      fileName: e.file.name,
      loaded: 0,
      total: e.file.size,
      speed: 0,
      done: false,
      error: false,
    }));

    setSession({ files: initialFiles, finished: false });
    setMinimized(false);

    for (let i = 0; i < entries.length; i++) {
      const { file, pedidoId } = entries[i];
      try {
        await uploadViaServer(file, pedidoId, (loaded, total, speed) => {
          setSession((prev) =>
            prev ? { ...prev, files: prev.files.map((f, idx) =>
              idx === i ? { ...f, loaded, total, speed } : f
            )} : prev
          );
        });
        setSession((prev) =>
          prev ? { ...prev, files: prev.files.map((f, idx) =>
            idx === i ? { ...f, loaded: file.size, total: file.size, speed: 0, done: true } : f
          )} : prev
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setSession((prev) =>
          prev ? { ...prev, files: prev.files.map((f, idx) =>
            idx === i ? { ...f, error: true, done: true, errorMsg: msg } : f
          )} : prev
        );
      }
    }

    setSession((prev) => prev ? { ...prev, finished: true } : prev);
  }, []);

  // Auto-dismiss 3s after successful completion
  useEffect(() => {
    if (!session?.finished) return;
    const anyError = session.files.some((f) => f.error);
    if (!anyError) {
      const t = setTimeout(() => setSession(null), 3000);
      return () => clearTimeout(t);
    }
  }, [session?.finished]);

  if (!session) return <UploadContext.Provider value={{ startUploads }}>{children}</UploadContext.Provider>;

  const allDone = session.files.every((f) => f.done);
  const totalLoaded = session.files.reduce((a, f) => a + f.loaded, 0);
  const totalSize = session.files.reduce((a, f) => a + f.total, 0);
  const pct = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
  const hasErrors = session.files.some((f) => f.error);

  return (
    <UploadContext.Provider value={{ startUploads }}>
      {children}

      <div className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none ${
            allDone && !hasErrors ? "bg-emerald-600" : allDone && hasErrors ? "bg-red-600" : "bg-[#1a1a2e]"
          }`}
          onClick={() => setMinimized((m) => !m)}
        >
          <div className="flex items-center gap-2">
            {!allDone && (
              <svg className="animate-spin w-3.5 h-3.5 text-[#f5a623]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {allDone && !hasErrors && <span className="text-white text-sm">✓</span>}
            {allDone && hasErrors && <span className="text-white text-sm">⚠</span>}
            <span className="text-white text-xs font-bold">
              {allDone
                ? hasErrors ? "Error al subir archivos" : "¡Archivos subidos!"
                : `Subiendo ${session.files.length} archivo${session.files.length > 1 ? "s" : ""}… ${pct}%`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-xs">{minimized ? "▲" : "▼"}</span>
            {allDone && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setSession(null); }}
                className="text-zinc-300 hover:text-white text-sm leading-none transition">✕</button>
            )}
          </div>
        </div>

        {/* Progress bar while uploading */}
        {!allDone && (
          <div className="h-1 bg-zinc-100">
            <div className="h-full bg-[#f5a623] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Body */}
        {!minimized && (
          <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
            {session.files.map((f, i) => {
              const filePct = f.total > 0 ? Math.round((f.loaded / f.total) * 100) : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-700 truncate max-w-[180px] font-medium">{f.fileName}</span>
                    <span className={`text-xs font-bold shrink-0 ${
                      f.error ? "text-red-500" : f.done ? "text-emerald-600" : "text-zinc-400"
                    }`}>
                      {f.error ? "Error" : f.done ? "✓" : `${filePct}%`}
                    </span>
                  </div>
                  {f.error && f.errorMsg && (
                    <p className="text-xs text-red-400">{f.errorMsg}</p>
                  )}
                  {!f.done && (
                    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#f5a623] rounded-full transition-all" style={{ width: `${filePct}%` }} />
                    </div>
                  )}
                  {f.speed > 0 && !f.done && (
                    <p className="text-xs text-zinc-400">{fmtSize(f.loaded)} / {fmtSize(f.total)} · {fmtSize(f.speed)}/s</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UploadContext.Provider>
  );
}
