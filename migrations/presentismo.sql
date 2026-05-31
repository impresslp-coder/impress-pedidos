-- ============================================================
-- Migración: módulo de presentismo y empleados
-- Correr en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS asistencia (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios_sistema(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  estado        TEXT NOT NULL DEFAULT 'presente'
                CHECK (estado IN ('presente', 'ausente', 'licencia', 'feriado')),
  hora_entrada  TIME,
  hora_salida   TIME,
  notas         TEXT,
  certificado_url TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_asistencia" ON asistencia
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_write_asistencia" ON asistencia
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_usuario ON asistencia(usuario_id);
