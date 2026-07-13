-- ============================================================
-- SETUP COMPLETO — impress-pedidos
-- ============================================================
-- Consolida TODAS las migraciones sueltas de /migrations y /scripts
-- en un solo script idempotente. Correr en Supabase > SQL Editor.
-- Se puede correr varias veces sin romper nada (IF NOT EXISTS en todo).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COLUMNAS NUEVAS EN TABLAS DEL SCHEMA BASE
-- ============================================================

-- productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo             TEXT DEFAULT 'encargo',
  ADD COLUMN IF NOT EXISTS precio           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS precio_compra    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS descuento_maximo NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foto_url         TEXT,
  ADD COLUMN IF NOT EXISTS codigo_barras    TEXT,
  ADD COLUMN IF NOT EXISTS activo           BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_barras_unique
  ON productos (codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';

-- items_venta
ALTER TABLE items_venta
  ADD COLUMN IF NOT EXISTS descuento_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS producto_id   UUID REFERENCES productos(id) ON DELETE SET NULL;

-- ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS medio_pago TEXT;

-- usuarios_sistema
ALTER TABLE usuarios_sistema
  ADD COLUMN IF NOT EXISTS codigo_personal TEXT;

-- pedidos (base + operacion + tapas + cola + campos MP)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS codigo_unico        TEXT,
  ADD COLUMN IF NOT EXISTS quien_cargo_codigo  TEXT,
  ADD COLUMN IF NOT EXISTS medio_pago          TEXT,
  ADD COLUMN IF NOT EXISTS via_contacto        TEXT,
  ADD COLUMN IF NOT EXISTS prioridad           TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS mensaje             TEXT,
  ADD COLUMN IF NOT EXISTS telefono_contacto   TEXT,
  ADD COLUMN IF NOT EXISTS sucursal_produccion TEXT,
  ADD COLUMN IF NOT EXISTS sucursal_retiro     TEXT,
  ADD COLUMN IF NOT EXISTS orden_produccion    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imprimir_tapas      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ubicacion           TEXT,
  ADD COLUMN IF NOT EXISTS entregado_por       UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS entregado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS medio_pago_restante TEXT,
  ADD COLUMN IF NOT EXISTS sucursal_movida_por UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS sucursal_movida_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ubicacion_por       UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS ubicacion_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eliminado_por       UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS eliminado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queja_motivo        TEXT,
  ADD COLUMN IF NOT EXISTS queja_por           UUID REFERENCES usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS queja_en            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mercado_pago_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS mercado_pago_monto      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS mercado_pago_hora       TIMESTAMPTZ;

UPDATE pedidos SET orden_produccion = COALESCE(CAST(numero AS INT), 0)
WHERE orden_produccion = 0 OR orden_produccion IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_orden_produccion       ON pedidos(orden_produccion);
CREATE INDEX IF NOT EXISTS idx_pedidos_eliminado              ON pedidos(eliminado);
CREATE INDEX IF NOT EXISTS idx_pedidos_ubicacion              ON pedidos(ubicacion);
CREATE INDEX IF NOT EXISTS idx_pedidos_queja_en               ON pedidos(queja_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_mercado_pago_payment_id ON pedidos(mercado_pago_payment_id);

-- archivos_pedido (estado por archivo + storage path para Supabase Storage)
ALTER TABLE archivos_pedido
  ADD COLUMN IF NOT EXISTS estado       TEXT DEFAULT 'Encargo recibido',
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

UPDATE archivos_pedido SET estado = 'Encargo recibido' WHERE estado IS NULL;

CREATE INDEX IF NOT EXISTS idx_archivos_pedido_storage_path
  ON archivos_pedido(storage_path)
  WHERE storage_path IS NOT NULL;

-- ============================================================
-- 2. TABLAS NUEVAS INDEPENDIENTES
-- ============================================================

-- parametros_precio (modos de precio de encargos)
CREATE TABLE IF NOT EXISTS parametros_precio (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre           TEXT NOT NULL,
  precio           NUMERIC(10,4) NOT NULL,
  divisor          NUMERIC(10,4) NOT NULL DEFAULT 1,
  descuento_maximo NUMERIC(5,2) DEFAULT 100,
  activo           BOOLEAN DEFAULT TRUE,
  creado_en        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE parametros_precio
  ADD COLUMN IF NOT EXISTS descuento_maximo NUMERIC(5,2) DEFAULT 100;

-- stock (1:1 con productos)
CREATE TABLE IF NOT EXISTS stock (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id    UUID UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  cantidad       INTEGER DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- impresoras + registros_ciclos
CREATE TABLE IF NOT EXISTS impresoras (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre    TEXT NOT NULL,
  modelo    TEXT,
  sucursal  TEXT,
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registros_ciclos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  impresora_id  UUID NOT NULL REFERENCES impresoras(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  ciclos_dia    INT  NOT NULL DEFAULT 0,
  nivel_toner   TEXT CHECK (nivel_toner IN ('lleno', 'medio', 'bajo', 'vacio')),
  observaciones TEXT,
  usuario_id    UUID REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(impresora_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_registros_ciclos_fecha     ON registros_ciclos(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_ciclos_impresora ON registros_ciclos(impresora_id);

-- asistencia (presentismo)
CREATE TABLE IF NOT EXISTS asistencia (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES usuarios_sistema(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  estado          TEXT NOT NULL DEFAULT 'presente'
                    CHECK (estado IN ('presente', 'ausente', 'licencia', 'feriado')),
  hora_entrada    TIME,
  hora_salida     TIME,
  notas           TEXT,
  certificado_url TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_fecha   ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_usuario ON asistencia(usuario_id);

-- proveedores + proveedor_articulos
CREATE TABLE IF NOT EXISTS proveedores (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  contacto   TEXT,
  telefono   TEXT,
  email      TEXT,
  notas      TEXT,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proveedor_articulos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id        UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  unidad              TEXT NOT NULL DEFAULT 'unidad',
  precio_costo        NUMERIC(12,4) NOT NULL DEFAULT 0,
  markup_pct          NUMERIC(8,2)  NOT NULL DEFAULT 0,
  tiempo_entrega_dias INTEGER       NOT NULL DEFAULT 1,
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE proveedor_articulos
  ADD COLUMN IF NOT EXISTS plancha_ancho_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS plancha_alto_cm  NUMERIC(8,2);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proveedor_articulos_updated ON proveedor_articulos;
CREATE TRIGGER trg_proveedor_articulos_updated
  BEFORE UPDATE ON proveedor_articulos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- terciarizados (vinculo con clientes y proveedor_articulos)
ALTER TABLE terciarizados
  ADD COLUMN IF NOT EXISTS cliente_id            UUID REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proveedor_articulo_id UUID REFERENCES proveedor_articulos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS precio_costo          NUMERIC(12,4);

CREATE INDEX IF NOT EXISTS idx_terciarizados_cliente_id ON terciarizados(cliente_id);

-- stock_sucursal
CREATE TABLE IF NOT EXISTS stock_sucursal (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sucursal    TEXT NOT NULL,
  cantidad    INT  NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id, sucursal)
);

CREATE INDEX IF NOT EXISTS idx_stock_sucursal_producto ON stock_sucursal(producto_id);

-- pedido_print_events (estadisticas de impresion)
CREATE TABLE IF NOT EXISTS pedido_print_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id         UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  archivo_id        UUID REFERENCES archivos_pedido(id) ON DELETE SET NULL,
  source_type       TEXT NOT NULL CHECK (source_type IN ('pdf', 'ticket')),
  ticket_type       TEXT CHECK (ticket_type IN ('pedido', 'entrega')),
  job_name          TEXT,
  printer_name      TEXT,
  status            TEXT NOT NULL DEFAULT 'completed',
  paginas_impresas  INTEGER NOT NULL DEFAULT 0,
  hojas_estimadas   INTEGER NOT NULL DEFAULT 0,
  copias            INTEGER NOT NULL DEFAULT 1,
  paper_name        TEXT,
  duplex_mode       TEXT,
  color             BOOLEAN DEFAULT FALSE,
  page_ranges       TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms       INTEGER,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_print_events_pedido
  ON pedido_print_events(pedido_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedido_print_events_archivo
  ON pedido_print_events(archivo_id);

-- caja_jornadas (caja + estadisticas)
CREATE TABLE IF NOT EXISTS caja_jornadas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo           TEXT NOT NULL,
  usuario_id     UUID REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
  usuario_nombre TEXT,
  billetes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  gastos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE caja_jornadas ADD COLUMN IF NOT EXISTS gastos JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caja_jornadas_tipo_check') THEN
    ALTER TABLE caja_jornadas DROP CONSTRAINT caja_jornadas_tipo_check;
  END IF;
END $$;

ALTER TABLE caja_jornadas
  ADD CONSTRAINT caja_jornadas_tipo_check
  CHECK (tipo IN ('inicio', 'cierre', 'retiro', 'gasto'));

CREATE INDEX IF NOT EXISTS caja_jornadas_created_at_idx ON caja_jornadas(created_at DESC);
CREATE INDEX IF NOT EXISTS caja_jornadas_tipo_idx       ON caja_jornadas(tipo);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE parametros_precio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock                ENABLE ROW LEVEL SECURITY;
ALTER TABLE impresoras           ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ciclos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_articulos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sucursal       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_print_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_jornadas        ENABLE ROW LEVEL SECURITY;

-- Policies (DROP+CREATE para hacerlas idempotentes)
DROP POLICY IF EXISTS "auth_read_parametros_precio"        ON parametros_precio;
CREATE POLICY "auth_read_parametros_precio"                ON parametros_precio    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_parametros_precio"       ON parametros_precio;
CREATE POLICY "auth_write_parametros_precio"               ON parametros_precio    FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_stock"                    ON stock;
CREATE POLICY "auth_read_stock"                            ON stock                FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_stock"                   ON stock;
CREATE POLICY "auth_write_stock"                           ON stock                FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_impresoras"               ON impresoras;
CREATE POLICY "auth_read_impresoras"                       ON impresoras           FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_impresoras"              ON impresoras;
CREATE POLICY "auth_write_impresoras"                      ON impresoras           FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_registros_ciclos"         ON registros_ciclos;
CREATE POLICY "auth_read_registros_ciclos"                 ON registros_ciclos     FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_registros_ciclos"        ON registros_ciclos;
CREATE POLICY "auth_write_registros_ciclos"                ON registros_ciclos     FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_asistencia"               ON asistencia;
CREATE POLICY "auth_read_asistencia"                       ON asistencia           FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_asistencia"              ON asistencia;
CREATE POLICY "auth_write_asistencia"                      ON asistencia           FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_proveedores"              ON proveedores;
CREATE POLICY "auth_read_proveedores"                      ON proveedores          FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_read_proveedor_articulos"      ON proveedor_articulos;
CREATE POLICY "auth_read_proveedor_articulos"              ON proveedor_articulos  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_all_proveedores"            ON proveedores;
CREATE POLICY "service_all_proveedores"                    ON proveedores          FOR ALL    TO service_role  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_proveedor_articulos"    ON proveedor_articulos;
CREATE POLICY "service_all_proveedor_articulos"            ON proveedor_articulos  FOR ALL    TO service_role  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_stock_sucursal"           ON stock_sucursal;
CREATE POLICY "auth_read_stock_sucursal"                   ON stock_sucursal       FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_stock_sucursal"          ON stock_sucursal;
CREATE POLICY "auth_write_stock_sucursal"                  ON stock_sucursal       FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios autenticados leen print events"      ON pedido_print_events;
CREATE POLICY "usuarios autenticados leen print events"              ON pedido_print_events  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "usuarios autenticados escriben print events"  ON pedido_print_events;
CREATE POLICY "usuarios autenticados escriben print events"          ON pedido_print_events  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_caja_jornadas"            ON caja_jornadas;
CREATE POLICY "auth_read_caja_jornadas"                    ON caja_jornadas        FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_caja_jornadas"           ON caja_jornadas;
CREATE POLICY "auth_write_caja_jornadas"                   ON caja_jornadas        FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. CONFIGURACION INICIAL (defaults del formulario Ventas)
-- ============================================================

INSERT INTO configuracion (clave, valor) VALUES
  ('ventas_tipos_papel',       'Comun:1-10=80;11-50=60;51-9999=45,Opalina:1-10=140;11-50=120;51-9999=100,Fotografico:1-9999=180'),
  ('ventas_extra_abrochado',   '0'),
  ('ventas_extra_anillado',    '0'),
  ('ventas_extra_encuadernado','0'),
  ('pedidos_precio_hoja',      '150'),
  ('pedidos_extra_anillado',   '4250'),
  ('pedidos_extra_encuadernado','0'),
  ('default_presentacion',     'suelto'),
  ('default_faz',              'simple'),
  ('default_pag_por_hoja',     '1')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- 5. NOTIFICAR A PostgREST QUE RECARGUE EL SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';
