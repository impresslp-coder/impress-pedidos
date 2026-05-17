-- ============================================================
-- IMPRESS PEDIDOS — Schema Supabase
-- Correr en: https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USUARIOS DEL SISTEMA
-- ─────────────────────────────────────────────
CREATE TABLE usuarios_sistema (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'operador', -- 'admin' | 'operador'
  sucursal_default TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: crea fila en usuarios_sistema cuando se crea un usuario en auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usuarios_sistema (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'operador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────────
CREATE TABLE clientes (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo    TEXT UNIQUE NOT NULL,
  nombre    TEXT NOT NULL,
  cod_pais  TEXT DEFAULT '54',
  telefono  TEXT,
  mail      TEXT,
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_nombre ON clientes(nombre);
CREATE INDEX idx_clientes_telefono ON clientes(telefono);

-- ─────────────────────────────────────────────
-- PRODUCTOS / CATÁLOGO
-- ─────────────────────────────────────────────
CREATE TABLE productos (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre    TEXT NOT NULL,
  paginas   INTEGER,
  precio_d  NUMERIC(10,2),  -- precio categoría D
  precio_e  NUMERIC(10,2),  -- precio categoría E
  precio_f  NUMERIC(10,2),  -- precio categoría F
  precio_g  NUMERIC(10,2),  -- precio categoría G
  categoria TEXT,
  link_pdf  TEXT,           -- link Drive al archivo de muestra
  activo    BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK (uno por producto)
CREATE TABLE stock (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id    UUID UNIQUE REFERENCES productos(id) ON DELETE CASCADE,
  cantidad       INTEGER DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- COUNTER — para números de pedido correlativo
-- ─────────────────────────────────────────────
CREATE TABLE counters (
  nombre   TEXT PRIMARY KEY,
  valor    INTEGER DEFAULT 0
);
INSERT INTO counters (nombre, valor) VALUES ('pedidos', 0), ('presupuestos', 0), ('terciarizados', 0), ('ventas', 0);

-- Función para obtener y avanzar el counter (thread-safe)
CREATE OR REPLACE FUNCTION next_counter(p_nombre TEXT)
RETURNS INTEGER AS $$
DECLARE v_val INTEGER;
BEGIN
  UPDATE counters SET valor = valor + 1 WHERE nombre = p_nombre RETURNING valor INTO v_val;
  RETURN v_val;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- PEDIDOS
-- ─────────────────────────────────────────────
CREATE TABLE pedidos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT UNIQUE NOT NULL,         -- '0000001'
  usuario_id      UUID REFERENCES usuarios_sistema(id),
  fecha           TIMESTAMPTZ DEFAULT NOW(),
  cliente_id      UUID REFERENCES clientes(id),
  estado          TEXT DEFAULT 'Encargo recibido',
  medio_contacto  TEXT,
  sucursal        TEXT,
  senia           NUMERIC(10,2) DEFAULT 0,
  carpeta_url     TEXT,
  url_comprobante TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha DESC);

CREATE TABLE items_pedido (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto      TEXT NOT NULL,
  anotacion     TEXT,
  paginas       INTEGER,
  modo          TEXT,
  pago          TEXT,
  precio        NUMERIC(10,2),
  descuento     NUMERIC(5,2) DEFAULT 0,
  lugar_entrega TEXT,
  dia_entrega   DATE,
  hora_entrega  TEXT,
  url_pdf       TEXT,
  estado        TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_pedido_pedido ON items_pedido(pedido_id);

-- ─────────────────────────────────────────────
-- PRESUPUESTOS
-- ─────────────────────────────────────────────
CREATE TABLE presupuestos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero           TEXT UNIQUE NOT NULL,
  usuario_id       UUID REFERENCES usuarios_sistema(id),
  cliente_id       UUID REFERENCES clientes(id),
  fecha            TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento DATE,
  total            NUMERIC(10,2),
  medio_contacto   TEXT,
  url_pdf          TEXT,
  creado_en        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items_presupuesto (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id   UUID REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto         TEXT NOT NULL,
  modo             TEXT,
  paginas          INTEGER,
  precio           NUMERIC(10,2),
  descuento        NUMERIC(5,2) DEFAULT 0,
  unidades         INTEGER DEFAULT 1
);

-- ─────────────────────────────────────────────
-- CATÁLOGO ENCARGOS (terciarizados)
-- ─────────────────────────────────────────────
CREATE TABLE catalogo_encargos (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre    TEXT NOT NULL,
  precio    NUMERIC(10,2),
  activo    BOOLEAN DEFAULT TRUE
);

-- ─────────────────────────────────────────────
-- TERCIARIZADOS
-- ─────────────────────────────────────────────
CREATE TABLE terciarizados (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT NOT NULL,
  usuario_id      UUID REFERENCES usuarios_sistema(id),
  fecha           DATE DEFAULT CURRENT_DATE,
  cliente         TEXT NOT NULL,
  item            TEXT NOT NULL,
  anotacion       TEXT,
  total           NUMERIC(10,2),
  senia           NUMERIC(10,2) DEFAULT 0,
  estado          TEXT DEFAULT 'Encargo recibido',
  telefono        TEXT,
  sucursal        TEXT,
  url_comprobante TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RECLAMOS
-- ─────────────────────────────────────────────
CREATE TABLE reclamos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_reclamo  TEXT NOT NULL,
  pedido_numero   TEXT NOT NULL,
  fecha           DATE DEFAULT CURRENT_DATE,
  texto           TEXT,
  sucursal        TEXT,
  estado          TEXT DEFAULT 'Reclamo recibido',
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STOCK ÚTILES (mercadería para venta)
-- ─────────────────────────────────────────────
CREATE TABLE stock_utiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo        TEXT UNIQUE NOT NULL,
  nombre        TEXT NOT NULL,
  precio_compra NUMERIC(10,2),
  precio_venta  NUMERIC(10,2),
  stock         INTEGER DEFAULT 0,
  activo        BOOLEAN DEFAULT TRUE
);

-- ─────────────────────────────────────────────
-- VENTAS
-- ─────────────────────────────────────────────
CREATE TABLE ventas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_venta    TEXT UNIQUE NOT NULL,
  usuario_id      UUID REFERENCES usuarios_sistema(id),
  fecha           TIMESTAMPTZ DEFAULT NOW(),
  sucursal        TEXT,
  total           NUMERIC(10,2),
  url_comprobante TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items_venta (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id         UUID REFERENCES ventas(id) ON DELETE CASCADE,
  producto_codigo  TEXT,
  producto_nombre  TEXT NOT NULL,
  cantidad         INTEGER DEFAULT 1,
  precio_unitario  NUMERIC(10,2),
  precio_venta     NUMERIC(10,2),
  total            NUMERIC(10,2),
  creado_en        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- REGISTRO (log de acciones)
-- ─────────────────────────────────────────────
CREATE TABLE registro (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT,
  referencia  TEXT,
  fecha       TIMESTAMPTZ DEFAULT NOW(),
  mensaje     TEXT,
  usuario_id  UUID REFERENCES usuarios_sistema(id)
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE usuarios_sistema   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_pedido       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_presupuesto  ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_encargos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE terciarizados      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_utiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_venta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro           ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters           ENABLE ROW LEVEL SECURITY;

-- Política base: usuarios autenticados pueden ver todo
CREATE POLICY "usuarios autenticados leen" ON clientes          FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON productos         FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON stock             FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON pedidos           FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON items_pedido      FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON presupuestos      FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON items_presupuesto FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON catalogo_encargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON terciarizados     FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON reclamos          FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON stock_utiles      FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON ventas            FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON items_venta       FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON registro          FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios autenticados leen" ON usuarios_sistema  FOR SELECT TO authenticated USING (true);

-- Escritura: usuarios autenticados pueden escribir (la validación de rol va en server actions)
CREATE POLICY "usuarios autenticados escriben" ON clientes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON productos         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON stock             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON pedidos           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON items_pedido      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON presupuestos      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON items_presupuesto FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON catalogo_encargos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON terciarizados     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON reclamos          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON stock_utiles      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON ventas            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON items_venta       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "usuarios autenticados escriben" ON registro          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service role lee counters"      ON counters          FOR ALL TO service_role USING (true) WITH CHECK (true);

-- usuarios_sistema: cada usuario ve/edita la suya; admin ve todas
CREATE POLICY "ver propio o admin" ON usuarios_sistema
  FOR ALL TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM usuarios_sistema u WHERE u.id = auth.uid() AND u.rol = 'admin'
  ));

-- ─────────────────────────────────────────────
-- ARCHIVOS DE PEDIDO (Google Drive)
-- Agregar en Supabase SQL Editor si no existe
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos_pedido (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id        UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  nombre_archivo   TEXT NOT NULL,
  google_file_id   TEXT NOT NULL,
  creado_en        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE archivos_pedido ENABLE ROW LEVEL SECURITY;

-- Si ya existe la tabla con columnas extra, solo agregar las políticas:
DROP POLICY IF EXISTS "usuarios autenticados leen archivos"    ON archivos_pedido;
DROP POLICY IF EXISTS "usuarios autenticados escriben archivos" ON archivos_pedido;

CREATE POLICY "usuarios autenticados leen archivos"
  ON archivos_pedido FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuarios autenticados escriben archivos"
  ON archivos_pedido FOR ALL TO authenticated USING (true) WITH CHECK (true);
