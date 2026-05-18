ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS ubicacion TEXT,
  ADD COLUMN IF NOT EXISTS entregado_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS medio_pago_restante TEXT,
  ADD COLUMN IF NOT EXISTS sucursal_movida_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS sucursal_movida_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ubicacion_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS ubicacion_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eliminado_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queja_motivo TEXT,
  ADD COLUMN IF NOT EXISTS queja_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS queja_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mercado_pago_monto NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS mercado_pago_hora TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_eliminado ON pedidos(eliminado);
CREATE INDEX IF NOT EXISTS idx_pedidos_ubicacion ON pedidos(ubicacion);
CREATE INDEX IF NOT EXISTS idx_pedidos_queja_en ON pedidos(queja_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_mercado_pago_payment_id ON pedidos(mercado_pago_payment_id);
