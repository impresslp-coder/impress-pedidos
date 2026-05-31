-- ============================================================
-- Migración: módulo de mantenimiento de impresoras
-- Correr en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS impresoras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  modelo      TEXT,
  sucursal    TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
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

ALTER TABLE impresoras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_impresoras"       ON impresoras       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_impresoras"      ON impresoras       FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_read_registros_ciclos" ON registros_ciclos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_registros_ciclos" ON registros_ciclos FOR ALL   TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_registros_ciclos_fecha       ON registros_ciclos(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_ciclos_impresora   ON registros_ciclos(impresora_id);
