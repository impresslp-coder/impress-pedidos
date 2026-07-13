import { createAdminClient } from "@/lib/supabase/admin";

export const ARCHIVOS_BUCKET = "archivos-pedidos";

export function buildStoragePath(pedidoId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${pedidoId}/${Date.now()}_${safeName}`;
}

export async function uploadArchivoToStorage(
  pedidoId: string,
  fileName: string,
  buffer: Buffer,
  contentType = "application/pdf",
): Promise<string> {
  const admin = createAdminClient();
  const path = buildStoragePath(pedidoId, fileName);
  const { error } = await admin.storage
    .from(ARCHIVOS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  return path;
}

export async function downloadArchivoFromStorage(path: string): Promise<Buffer> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(ARCHIVOS_BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download: ${error?.message ?? "sin datos"}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createSignedUploadUrl(pedidoId: string, fileName: string) {
  const admin = createAdminClient();
  const path = buildStoragePath(pedidoId, fileName);
  const { data, error } = await admin.storage
    .from(ARCHIVOS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Signed URL: ${error?.message ?? "sin datos"}`);
  return { path, token: data.token, signedUrl: data.signedUrl };
}
