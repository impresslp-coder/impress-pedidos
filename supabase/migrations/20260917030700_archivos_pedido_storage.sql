-- Los archivos nuevos se guardan en Supabase Storage. google_file_id solo aplica
-- a adjuntos históricos conservados en Google Drive.
ALTER TABLE public.archivos_pedido
  ALTER COLUMN google_file_id DROP NOT NULL;
