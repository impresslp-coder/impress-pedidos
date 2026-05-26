-- ============================================================
-- Migración: Módulo de Proveedores
-- Correr en Supabase > SQL Editor
-- ============================================================

-- 1. Tabla de proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  telefono    TEXT,
  email       TEXT,
  notas       TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de artículos por proveedor
CREATE TABLE IF NOT EXISTS proveedor_articulos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id         UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  descripcion          TEXT,
  unidad               TEXT NOT NULL DEFAULT 'unidad',
  precio_costo         NUMERIC(12,4) NOT NULL DEFAULT 0,
  markup_pct           NUMERIC(8,2)  NOT NULL DEFAULT 0,
  tiempo_entrega_dias  INTEGER       NOT NULL DEFAULT 1,
  activo               BOOLEAN       NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. Trigger para updated_at
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

-- 4. RLS
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedor_articulos ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer
CREATE POLICY "auth_read_proveedores"
  ON proveedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_read_proveedor_articulos"
  ON proveedor_articulos FOR SELECT TO authenticated USING (true);

-- Service role tiene acceso total (lo usan las API routes server-side)
CREATE POLICY "service_all_proveedores"
  ON proveedores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_proveedor_articulos"
  ON proveedor_articulos FOR ALL TO service_role USING (true) WITH CHECK (true);
