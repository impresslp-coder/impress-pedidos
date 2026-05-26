-- ============================================================
-- Migración: vincular terciarizados con proveedor_articulos
-- Correr en Supabase > SQL Editor
-- ============================================================

ALTER TABLE terciarizados
  ADD COLUMN IF NOT EXISTS proveedor_articulo_id UUID REFERENCES proveedor_articulos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS precio_costo NUMERIC(12,4);
