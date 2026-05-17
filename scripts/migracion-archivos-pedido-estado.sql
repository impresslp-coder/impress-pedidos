-- Necesaria para manejar estados por archivo dentro de cada pedido.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE archivos_pedido
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Encargo recibido';

UPDATE archivos_pedido
SET estado = 'Encargo recibido'
WHERE estado IS NULL;

NOTIFY pgrst, 'reload schema';
