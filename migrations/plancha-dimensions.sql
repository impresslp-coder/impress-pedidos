-- ============================================================
-- Migración: dimensiones de plancha en artículos de proveedor
-- Correr en Supabase > SQL Editor
-- ============================================================

ALTER TABLE proveedor_articulos
  ADD COLUMN IF NOT EXISTS plancha_ancho_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS plancha_alto_cm  NUMERIC(8,2);

-- Comentario de uso:
-- Si el artículo es una plancha (ej: "Sticker 3D UV 1mt×58cm"),
-- completar plancha_ancho_cm=100 y plancha_alto_cm=58.
-- Cuando están cargados, el formulario de encargos muestra
-- el calculador automático de stickers.
