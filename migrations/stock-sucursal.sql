-- ============================================================
-- Migración: stock visible por sucursal
-- Correr en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_sucursal (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id  UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sucursal     TEXT NOT NULL,
  cantidad     INT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id, sucursal)
);

-- RLS
ALTER TABLE stock_sucursal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_stock_sucursal" ON stock_sucursal
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_write_stock_sucursal" ON stock_sucursal
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índice
CREATE INDEX IF NOT EXISTS idx_stock_sucursal_producto ON stock_sucursal(producto_id);
