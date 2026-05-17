ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'encargo',
  ADD COLUMN IF NOT EXISTS precio NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS precio_compra NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS descuento_maximo NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_barras_unique
  ON productos (codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';

CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE archivos_pedido
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Encargo recibido';

INSERT INTO configuracion (clave, valor) VALUES
  ('ventas_tipos_papel', 'Comun:1-10=80;11-50=60;51-9999=45,Opalina:1-10=140;11-50=120;51-9999=100,Fotografico:1-9999=180'),
  ('ventas_extra_abrochado', '0'),
  ('ventas_extra_anillado', '0'),
  ('ventas_extra_encuadernado', '0')
ON CONFLICT (clave) DO NOTHING;
