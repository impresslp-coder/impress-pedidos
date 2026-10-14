"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Kind = "level" | "institution" | "career" | "subject";
type Category = { id: string; parent_id: string | null; kind: Kind; name: string; position: number; active: boolean };
type Item = { id: string; title: string; description: string; level_id: string; institution_id: string | null;
  career_id: string | null; subject_id: string | null; year_label: string | null; page_count: number;
  size_bytes: number; file_name: string; status: "draft" | "published"; download_count: number; created_at: string };
type Fields = { title: string; description: string; level_id: string; institution_id: string; career_id: string;
  subject_id: string; year_label: string; status: "draft" | "published" };

const empty: Fields = { title: "", description: "", level_id: "", institution_id: "", career_id: "", subject_id: "", year_label: "", status: "draft" };
const labels: Record<Kind, string> = { level: "Nivel", institution: "Institución / facultad", career: "Carrera / año", subject: "Materia / cátedra" };
const kinds: Kind[] = ["level", "institution", "career", "subject"];

async function api(method: string, body?: object, query = "") {
  const response = await fetch(`/api/admin/biblioteca${query}`, { method, credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted && char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "," || char === ";")) { row.push(cell.trim()); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const header = (rows.shift() || []).map(value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  return rows.map(values => Object.fromEntries(header.map((name, i) => [name, values[i] || ""])));
}

async function pdfCover(file: File): Promise<Blob> {
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await pdfDocument.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 320 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo generar la portada");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const cover = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!cover) throw new Error("No se pudo guardar la portada");
    return cover;
  } finally { await pdfDocument.destroy(); }
}

function CategorySelect({ kind, value, parent, categories, onChange }: {
  kind: Kind; value: string; parent?: string; categories: Category[]; onChange: (id: string) => void;
}) {
  const options = categories.filter(category => category.kind === kind && category.active &&
    (kind === "level" || category.parent_id === parent));
  return <label className="text-sm font-semibold text-zinc-700">{labels[kind]}
    <select value={value} onChange={event => onChange(event.target.value)}
      className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2">
      <option value="">{kind === "level" ? "Elegí un nivel" : "Opcional"}</option>
      {options.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
  </label>;
}

export default function BibliotecaManager() {
  const [tab, setTab] = useState<"materials" | "categories" | "bulk">("materials");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [fields, setFields] = useState<Fields>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState("");
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [categoryKind, setCategoryKind] = useState<Kind>("level");
  const [categoryParent, setCategoryParent] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");

  const refreshCategories = useCallback(async () => {
    const result = await api("GET", undefined, "?resource=categories");
    setCategories(result.categories);
  }, []);
  const refreshItems = useCallback(async () => {
    const result = await api("GET", undefined, `?resource=items&page=${page}&q=${encodeURIComponent(query)}`);
    setItems(result.items); setTotal(result.total);
  }, [page, query]);
  useEffect(() => { refreshCategories().catch(error => setMessage(error.message)); }, [refreshCategories]);
  useEffect(() => { refreshItems().catch(error => setMessage(error.message)); }, [refreshItems]);

  const updateField = (name: keyof Fields, value: string) => setFields(previous => {
    const next = { ...previous, [name]: value };
    if (name === "level_id") Object.assign(next, { institution_id: "", career_id: "", subject_id: "" });
    if (name === "institution_id") Object.assign(next, { career_id: "", subject_id: "" });
    if (name === "career_id") next.subject_id = "";
    return next;
  });

  async function uploadOne(pdf: File, metadata: Fields, id?: string) {
    if (!pdf.name.toLowerCase().endsWith(".pdf") || pdf.size > 50 * 1024 * 1024) throw new Error(`${pdf.name}: PDF inválido o mayor a 50 MB`);
    const cover = await pdfCover(pdf);
    const ticket = await api("POST", { action: "upload-ticket", file_name: pdf.name, size_bytes: pdf.size });
    for (const [url, body, type] of [[ticket.pdfUrl, pdf, "application/pdf"], [ticket.coverUrl, cover, "image/jpeg"]] as const) {
      const uploaded = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body });
      if (!uploaded.ok) throw new Error(`${pdf.name}: falló la subida de ${type === "application/pdf" ? "PDF" : "portada"}`);
    }
    await api("POST", { action: "finalize", id, ...metadata, file_name: pdf.name,
      pdf_path: ticket.pdfPath, cover_path: ticket.coverPath });
  }

  async function saveItem() {
    setBusy(true); setMessage("");
    try {
      if (!fields.level_id || !fields.title.trim()) throw new Error("Completá título y nivel");
      if (file) await uploadOne(file, fields, editing || undefined);
      else if (editing) await api("PATCH", { resource: "item", id: editing, ...fields });
      else throw new Error("Elegí un archivo PDF");
      setMessage(editing ? "Material actualizado" : "Material cargado");
      setFields(empty); setEditing(null); setFile(null); await refreshItems();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }

  async function saveCategory() {
    setBusy(true); setMessage("");
    try {
      await api("POST", { action: "category", name: categoryName, kind: categoryKind,
        parent_id: categoryKind === "level" ? null : categoryParent });
      setCategoryName(""); await refreshCategories(); setMessage("Categoría creada");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo crear"); }
    finally { setBusy(false); }
  }

  async function editCategory(category: Category, active?: boolean) {
    const name = active === undefined ? window.prompt("Nuevo nombre", category.name) : category.name;
    if (!name) return;
    try {
      await api("PATCH", { resource: "category", id: category.id, name, active: active ?? category.active, position: category.position });
      await refreshCategories(); setMessage("Categoría actualizada");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo editar"); }
  }

  function editItem(item: Item) {
    setFields({ title: item.title, description: item.description, level_id: item.level_id,
      institution_id: item.institution_id || "", career_id: item.career_id || "", subject_id: item.subject_id || "",
      year_label: item.year_label || "", status: item.status });
    setEditing(item.id); setFile(null); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteItem(item: Item) {
    if (!window.confirm(`¿Eliminar definitivamente “${item.title}”? Esta acción no se puede deshacer.`)) return;
    try {
      await api("DELETE", { resource: "item", id: item.id });
      await refreshItems(); setMessage("Material eliminado");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar"); }
  }

  const csvRows = useMemo(() => parseCsv(csv), [csv]);
  const bulkMap = useMemo(() => new Map(bulkFiles.map(value => [value.name.toLowerCase(), value])), [bulkFiles]);
  function categoryId(kind: Kind, name: string, parent: string | null): string {
    if (!name) return "";
    const match = categories.find(category => category.kind === kind && category.active &&
      category.name.toLocaleLowerCase("es-AR") === name.toLocaleLowerCase("es-AR") &&
      (kind === "level" || category.parent_id === parent));
    if (!match) throw new Error(`Falta categoría: ${name}`);
    return match.id;
  }

  async function importBulk() {
    setBusy(true); setMessage("");
    let done = 0; const failures: string[] = [];
    try {
      if (!csvRows.length) throw new Error("Cargá un CSV con encabezados y filas");
      const jobs = csvRows.map(row => {
        const name = row.archivo || row.filename;
        if (!name || !row.nivel) throw new Error("Cada fila necesita archivo y nivel");
        const pdf = bulkMap.get(name.toLowerCase());
        if (!pdf) throw new Error(`No se seleccionó el PDF ${name}`);
        const level_id = categoryId("level", row.nivel, null);
        const institution_id = categoryId("institution", row.institucion || row.facultad, level_id);
        const career_id = categoryId("career", row.carrera, institution_id);
        const subject_id = categoryId("subject", row.materia || row.catedra, career_id);
        return { pdf, fields: { title: row.titulo || name.replace(/\.pdf$/i, ""), description: row.descripcion || "",
          level_id, institution_id, career_id, subject_id, year_label: row.anio || "",
          status: row.estado?.toLowerCase() === "publicado" ? "published" as const : "draft" as const } };
      });
      let cursor = 0;
      const worker = async () => {
        while (cursor < jobs.length) {
          const job = jobs[cursor++];
          try { await uploadOne(job.pdf, job.fields); done++; }
          catch (error) { failures.push(`${job.pdf.name}: ${error instanceof Error ? error.message : "error"}`); }
          setProgress(`${done + failures.length} de ${jobs.length} procesados · ${done} cargados · ${failures.length} fallidos`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
      await refreshItems();
      setMessage(failures.length ? `Se cargaron ${done}. Fallaron: ${failures.slice(0, 5).join("; ")}` : `Se cargaron ${done} PDFs`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falló la importación"); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6 text-zinc-800">
    <div><h1 className="text-2xl font-black">Biblioteca Virtual</h1>
      <p className="mt-1 text-sm text-zinc-500">Administrá el catálogo del proyecto separado de Biblioteca. Los PDF y las portadas permanecen privados.</p></div>
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      {([ ["materials", "Materiales"], ["categories", "Categorías"], ["bulk", "Importar lote"] ] as const).map(([key, label]) =>
        <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === key ? "bg-[#1a1a2e] text-white" : "bg-white text-zinc-600 border border-zinc-200"}`}>{label}</button>)}
    </div>
    {message && <p role="status" className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">{message}</p>}

    {tab === "materials" && <>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-bold">{editing ? "Editar material" : "Cargar un PDF"}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Título<input value={fields.title} onChange={event => updateField("title", event.target.value)} maxLength={180} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
          <label className="text-sm font-semibold">Año / curso<input value={fields.year_label} onChange={event => updateField("year_label", event.target.value)} maxLength={40} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
          <CategorySelect kind="level" value={fields.level_id} categories={categories} onChange={value => updateField("level_id", value)} />
          <CategorySelect kind="institution" value={fields.institution_id} parent={fields.level_id} categories={categories} onChange={value => updateField("institution_id", value)} />
          <CategorySelect kind="career" value={fields.career_id} parent={fields.institution_id} categories={categories} onChange={value => updateField("career_id", value)} />
          <CategorySelect kind="subject" value={fields.subject_id} parent={fields.career_id} categories={categories} onChange={value => updateField("subject_id", value)} />
        </div>
        <label className="block text-sm font-semibold">Descripción<textarea value={fields.description} onChange={event => updateField("description", event.target.value)} maxLength={1000} rows={3} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-semibold">PDF {editing && <span className="font-normal text-zinc-500">(opcional para reemplazar)</span>}
            <span onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null); }}
              className="mt-1 block rounded-lg border-2 border-dashed border-zinc-300 p-3 text-xs text-zinc-500">Arrastrá un PDF acá o elegilo abajo · {file?.name || "Ninguno"}</span>
            <input type="file" accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} className="mt-1 block text-sm" /></label>
          <label className="text-sm font-semibold">Estado<select value={fields.status} onChange={event => updateField("status", event.target.value)} className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2"><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
          <button disabled={busy} onClick={saveItem} className="rounded-lg bg-[#e6007e] px-5 py-2 font-bold text-white disabled:opacity-50">{busy ? "Procesando…" : editing ? "Guardar cambios" : "Subir PDF"}</button>
          {editing && <button onClick={() => { setEditing(null); setFields(empty); setFile(null); }} className="text-sm text-zinc-500">Cancelar</button>}
        </div>
        <p className="text-xs text-zinc-500">Máximo 50 MB por PDF. El sistema calcula páginas y tamaño; la portada se genera de la primera página.</p>
      </section>
      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Materiales ({total})</h2>
          <input aria-label="Buscar materiales" placeholder="Buscar por título" value={query} onChange={event => { setPage(0); setQuery(event.target.value); }} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></div>
        <div className="divide-y divide-zinc-100">{items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div><p className="font-bold">{item.title}</p><p className="text-xs text-zinc-500">{item.file_name} · {item.page_count} pág. · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB · {item.download_count} descargas · {item.status === "published" ? "Publicado" : "Borrador"}</p></div>
          <div className="flex gap-3"><button onClick={() => editItem(item)} className="font-bold text-blue-700">Editar</button><button onClick={() => deleteItem(item)} className="font-bold text-red-700">Eliminar</button></div>
        </div>)}</div>
        {!items.length && <p className="text-sm text-zinc-500">No hay materiales para mostrar.</p>}
        <div className="flex items-center gap-3 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Anterior</button><span>Página {page + 1}</span><button disabled={(page + 1) * 50 >= total} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Siguiente</button></div>
      </section>
    </>}

    {tab === "categories" && <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-bold">Categorías jerárquicas</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold">Tipo<select value={categoryKind} onChange={event => { setCategoryKind(event.target.value as Kind); setCategoryParent(""); }} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2">{kinds.map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}</select></label>
        {categoryKind !== "level" && <label className="text-sm font-semibold">Categoría superior<select value={categoryParent} onChange={event => setCategoryParent(event.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"><option value="">Elegí una</option>{categories.filter(category => category.kind === kinds[kinds.indexOf(categoryKind) - 1] && category.active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
        <label className="text-sm font-semibold">Nombre<input value={categoryName} onChange={event => setCategoryName(event.target.value)} maxLength={100} className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      </div>
      <button disabled={busy || !categoryName.trim() || (categoryKind !== "level" && !categoryParent)} onClick={saveCategory} className="rounded-lg bg-[#1a1a2e] px-5 py-2 font-bold text-white disabled:opacity-50">Crear categoría</button>
      <div className="divide-y divide-zinc-100">{categories.map(category => <div key={category.id} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className={category.active ? "" : "text-zinc-400"}><b>{labels[category.kind]}:</b> {category.name}{!category.active && " · Inactiva"}</span>
        <span className="flex gap-3"><button onClick={() => editCategory(category)} className="text-blue-700">Renombrar</button><button onClick={() => editCategory(category, !category.active)} className="text-zinc-600">{category.active ? "Desactivar" : "Activar"}</button></span>
      </div>)}</div>
    </section>}

    {tab === "bulk" && <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
      <h2 className="text-lg font-bold">Importación masiva</h2>
      <p className="text-sm text-zinc-600">Primero creá las categorías. El CSV relaciona cada PDF por nombre de archivo exacto y admite hasta miles de filas; las subidas se hacen de a tres. Encabezados: <code>archivo,titulo,descripcion,nivel,institucion,carrera,materia,anio,estado</code>. Estado <code>publicado</code> o <code>borrador</code>.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-semibold">CSV<input type="file" accept=".csv,text/csv" onChange={async event => setCsv(await (event.target.files?.[0]?.text() || Promise.resolve("")))} className="mt-2 block text-sm" /></label>
        <label className="block text-sm font-semibold">PDF (podés elegir muchos)
          <span onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setBulkFiles(Array.from(event.dataTransfer.files)); }}
            className="mt-2 block rounded-lg border-2 border-dashed border-zinc-300 p-3 text-xs text-zinc-500">Arrastrá los PDF acá · {bulkFiles.length} elegidos</span>
          <input type="file" multiple accept="application/pdf,.pdf" onChange={event => setBulkFiles(Array.from(event.target.files || []))} className="mt-2 block text-sm" /></label>
      </div>
      <p className="text-xs text-zinc-500">{csvRows.length} filas de CSV · {bulkFiles.length} PDF elegidos. Las filas con error se informan sin detener las demás.</p>
      <button disabled={busy || !csvRows.length || !bulkFiles.length} onClick={importBulk} className="rounded-lg bg-[#e6007e] px-5 py-2 font-bold text-white disabled:opacity-50">{busy ? "Importando…" : "Iniciar importación"}</button>
      {progress && <p role="status" className="text-sm font-semibold">{progress}</p>}
    </section>}
  </div>;
}
