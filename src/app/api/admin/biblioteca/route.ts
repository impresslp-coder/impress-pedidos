import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createBibliotecaAdminClient, isBibliotecaAdmin, isOwnOrigin, cleanText, categorySlug, isUuid } from "@/lib/biblioteca-admin";

export const dynamic = "force-dynamic";

const PDF_BUCKET = "biblioteca-pdf";
const COVER_BUCKET = "biblioteca-portadas";
const MAX_PDF = 50 * 1024 * 1024;
const MAX_COVER = 2 * 1024 * 1024;

class ValidationError extends Error {}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function fail(error: unknown) {
  if (error instanceof ValidationError) return json({ error: error.message }, 400);
  console.error("[admin/biblioteca]", error);
  return json({ error: "No pudimos completar la operación de Biblioteca." }, 503);
}

async function authorized(req: NextRequest) {
  if (!isOwnOrigin(req)) return false;
  return isBibliotecaAdmin();
}

function itemFields(raw: Record<string, unknown>) {
  const title = cleanText(raw.title, 180);
  const level_id = raw.level_id;
  if (!title || !isUuid(level_id)) throw new ValidationError("Título y nivel son obligatorios");
  const nullableId = (value: unknown) => value == null || value === "" ? null : isUuid(value) ? value : (() => { throw new ValidationError("Categoría inválida"); })();
  const status = raw.status === "published" ? "published" : "draft";
  return {
    title,
    description: cleanText(raw.description, 1000),
    level_id,
    institution_id: nullableId(raw.institution_id),
    career_id: nullableId(raw.career_id),
    subject_id: nullableId(raw.subject_id),
    year_label: cleanText(raw.year_label, 40) || null,
    status,
  };
}

async function inspectFiles(client: ReturnType<typeof createBibliotecaAdminClient>, pdfPath: string, coverPath: string) {
  const match = /^materiales\/([0-9a-f-]{36})\.pdf$/.exec(pdfPath);
  if (!match || !isUuid(match[1]) || coverPath !== `portadas/${match[1]}.jpg`) {
    throw new ValidationError("Ruta de archivo inválida");
  }
  const [pdfResult, coverResult] = await Promise.all([
    client.storage.from(PDF_BUCKET).download(pdfPath),
    client.storage.from(COVER_BUCKET).download(coverPath),
  ]);
  if (pdfResult.error || !pdfResult.data || coverResult.error || !coverResult.data) throw new ValidationError("Faltan archivos subidos");
  const pdf = new Uint8Array(await pdfResult.data.arrayBuffer());
  const cover = new Uint8Array(await coverResult.data.arrayBuffer());
  if (pdf.length < 5 || pdf.length > MAX_PDF || new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-") {
    throw new ValidationError("El archivo no es un PDF válido o supera 50 MB");
  }
  if (cover.length < 4 || cover.length > MAX_COVER || cover[0] !== 0xff || cover[1] !== 0xd8 || cover[2] !== 0xff) {
    throw new ValidationError("La portada no es un JPEG válido");
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let pageCount: number;
  try {
    const document = await pdfjs.getDocument({ data: pdf, useSystemFonts: false, disableFontFace: true }).promise;
    pageCount = document.numPages;
    await document.destroy();
  } catch { throw new ValidationError("El PDF no se pudo leer"); }
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new ValidationError("PDF sin páginas");
  return { pageCount, sizeBytes: pdf.length };
}

export async function GET(req: NextRequest) {
  if (!await authorized(req)) return json({ error: "No autorizado" }, 403);
  try {
    const client = createBibliotecaAdminClient();
    const resource = req.nextUrl.searchParams.get("resource");
    if (resource === "categories") {
      const { data, error } = await client.from("bv_categories").select("id,parent_id,kind,name,slug,position,active")
        .order("kind").order("position").order("name");
      if (error) throw error;
      return json({ categories: data });
    }
    if (resource === "items") {
      const page = Math.max(0, Math.min(1000, Number(req.nextUrl.searchParams.get("page")) || 0));
      const search = cleanText(req.nextUrl.searchParams.get("q"), 100).replace(/[%_]/g, "");
      let query = client.from("bv_library_items").select("id,title,description,level_id,institution_id,career_id,subject_id,year_label,page_count,size_bytes,file_name,storage_path,cover_path,status,download_count,created_at,published_at", { count: "exact" });
      if (search) query = query.ilike("title", `%${search}%`);
      const { data, count, error } = await query.order("created_at", { ascending: false }).range(page * 50, page * 50 + 49);
      if (error) throw error;
      return json({ items: data, total: count ?? 0, page });
    }
    return json({ error: "Recurso inválido" }, 400);
  } catch (error) { return fail(error); }
}

export async function POST(req: NextRequest) {
  if (!await authorized(req)) return json({ error: "No autorizado" }, 403);
  try {
    const body = await req.json() as Record<string, unknown>;
    const client = createBibliotecaAdminClient();
    if (body.action === "category") {
      const name = cleanText(body.name, 100);
      const kind = body.kind;
      const parent_id = body.parent_id == null || body.parent_id === "" ? null : body.parent_id;
      if (!name || !["level", "institution", "career", "subject"].includes(String(kind)) || (parent_id !== null && !isUuid(parent_id))) {
        return json({ error: "Categoría inválida" }, 400);
      }
      const slug = categorySlug(name);
      if (!slug) return json({ error: "El nombre debe contener letras o números" }, 400);
      const { data, error } = await client.from("bv_categories")
        .insert({ name, kind, parent_id, slug, position: Number.isInteger(body.position) ? body.position : 0 })
        .select("id,parent_id,kind,name,slug,position,active").single();
      if (error) return json({ error: error.message }, 400);
      return json({ category: data }, 201);
    }
    if (body.action === "upload-ticket") {
      const fileName = cleanText(body.file_name, 255);
      const size = Number(body.size_bytes);
      if (!fileName.toLowerCase().endsWith(".pdf") || !Number.isInteger(size) || size < 1 || size > MAX_PDF) {
        return json({ error: "Elegí un PDF de hasta 50 MB" }, 400);
      }
      const id = randomUUID();
      const pdfPath = `materiales/${id}.pdf`;
      const coverPath = `portadas/${id}.jpg`;
      const [pdf, cover] = await Promise.all([
        client.storage.from(PDF_BUCKET).createSignedUploadUrl(pdfPath),
        client.storage.from(COVER_BUCKET).createSignedUploadUrl(coverPath),
      ]);
      if (pdf.error || cover.error || !pdf.data?.signedUrl || !cover.data?.signedUrl) throw pdf.error || cover.error;
      return json({ pdfPath, coverPath, pdfUrl: pdf.data.signedUrl, coverUrl: cover.data.signedUrl });
    }
    if (body.action === "finalize") {
      const pdfPath = cleanText(body.pdf_path, 120);
      const coverPath = cleanText(body.cover_path, 120);
      const fileName = cleanText(body.file_name, 255);
      const fields = itemFields(body);
      if (!fileName.toLowerCase().endsWith(".pdf")) return json({ error: "Nombre de PDF inválido" }, 400);
      const { pageCount, sizeBytes } = await inspectFiles(client, pdfPath, coverPath);
      const id = body.id;
      const payload = { ...fields, page_count: pageCount, size_bytes: sizeBytes, file_name: fileName,
        storage_path: pdfPath, cover_path: coverPath, updated_at: new Date().toISOString(),
        published_at: fields.status === "published" ? new Date().toISOString() : null };
      let old: { storage_path: string; cover_path: string | null } | null = null;
      if (id != null && !isUuid(id)) return json({ error: "Material inválido" }, 400);
      if (id) {
        const current = await client.from("bv_library_items").select("storage_path,cover_path").eq("id", id).single();
        if (current.error || !current.data) return json({ error: "Material inexistente" }, 404);
        old = current.data;
      }
      const result = id
        ? await client.from("bv_library_items").update(payload).eq("id", id).select("id").single()
        : await client.from("bv_library_items").insert(payload).select("id").single();
      if (result.error) {
        await Promise.all([
          client.storage.from(PDF_BUCKET).remove([pdfPath]),
          client.storage.from(COVER_BUCKET).remove([coverPath]),
        ]);
        return json({ error: result.error.message }, 400);
      }
      if (old && old.storage_path !== pdfPath) {
        await Promise.all([
          client.storage.from(PDF_BUCKET).remove([old.storage_path]),
          old.cover_path ? client.storage.from(COVER_BUCKET).remove([old.cover_path]) : Promise.resolve(),
        ]);
      }
      return json({ id: result.data.id, pageCount, sizeBytes }, id ? 200 : 201);
    }
    return json({ error: "Acción inválida" }, 400);
  } catch (error) { return fail(error); }
}

export async function PATCH(req: NextRequest) {
  if (!await authorized(req)) return json({ error: "No autorizado" }, 403);
  try {
    const body = await req.json() as Record<string, unknown>;
    const client = createBibliotecaAdminClient();
    if (!isUuid(body.id)) return json({ error: "ID inválido" }, 400);
    if (body.resource === "category") {
      const name = cleanText(body.name, 100);
      if (!name) return json({ error: "Nombre obligatorio" }, 400);
      const { error } = await client.from("bv_categories").update({ name, slug: categorySlug(name),
        active: body.active !== false, position: Number.isInteger(body.position) ? body.position : 0 })
        .eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (body.resource === "item") {
      const fields = itemFields(body);
      const { data: before, error: readError } = await client.from("bv_library_items")
        .select("status,published_at").eq("id", body.id).single();
      if (readError || !before) return json({ error: "Material inexistente" }, 404);
      const { error } = await client.from("bv_library_items").update({ ...fields,
        published_at: fields.status === "published" ? before.published_at || new Date().toISOString() : null,
        updated_at: new Date().toISOString() }).eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Recurso inválido" }, 400);
  } catch (error) { return fail(error); }
}

export async function DELETE(req: NextRequest) {
  if (!await authorized(req)) return json({ error: "No autorizado" }, 403);
  try {
    const body = await req.json() as Record<string, unknown>;
    if (body.resource !== "item" || !isUuid(body.id)) return json({ error: "Material inválido" }, 400);
    const client = createBibliotecaAdminClient();
    const { count, error: countError } = await client.from("bv_downloads").select("id", { count: "exact", head: true }).eq("item_id", body.id);
    if (countError) throw countError;
    if (count) return json({ error: "Este PDF tiene descargas registradas. Despublicalo para conservar el historial." }, 409);
    const { data: item, error: readError } = await client.from("bv_library_items").select("storage_path,cover_path").eq("id", body.id).single();
    if (readError || !item) return json({ error: "Material inexistente" }, 404);
    const { error } = await client.from("bv_library_items").delete().eq("id", body.id);
    if (error) return json({ error: error.message }, 409);
    await Promise.all([
      client.storage.from(PDF_BUCKET).remove([item.storage_path]),
      item.cover_path ? client.storage.from(COVER_BUCKET).remove([item.cover_path]) : Promise.resolve(),
    ]);
    return json({ ok: true });
  } catch (error) { return fail(error); }
}
