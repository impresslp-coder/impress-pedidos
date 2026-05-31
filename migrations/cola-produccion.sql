-- ============================================================
-- Migración: orden de producción en pedidos
-- Correr en Supabase > SQL Editor
-- ============================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS orden_produccion INT DEFAULT 0;

-- Inicializar el orden con el número de pedido para mantener orden histórico
UPDATE pedidos SET orden_produccion = COALESCE(CAST(numero AS INT), 0)
WHERE orden_produccion = 0 OR orden_produccion IS NULL;

-- Índice para búsquedas ordenadas
CREATE INDEX IF NOT EXISTS idx_pedidos_orden_produccion ON pedidos(orden_produccion);
