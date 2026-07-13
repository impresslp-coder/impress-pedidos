-- Agregar columna storage_path a archivos_pedido para migrar de Google Drive a Supabase Storage.
-- Los archivos nuevos guardan storage_path (path dentro del bucket 'archivos-pedidos').
-- Los archivos viejos siguen usando google_file_id (fallback al helper de Drive).

ALTER TABLE archivos_pedido
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_archivos_pedido_storage_path
  ON archivos_pedido(storage_path)
  WHERE storage_path IS NOT NULL;
