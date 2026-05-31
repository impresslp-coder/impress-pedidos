-- ============================================================
-- Migración: vincular terciarizados con la tabla clientes
-- Correr en Supabase > SQL Editor
-- ============================================================

ALTER TABLE terciarizados
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- Índice para búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_terciarizados_cliente_id ON terciarizados(cliente_id);

-- Comentario:
-- Los encargos existentes quedan con cliente_id = NULL (campo libre legacy).
-- Los nuevos encargos creados desde el formulario actualizado guardarán el FK.
