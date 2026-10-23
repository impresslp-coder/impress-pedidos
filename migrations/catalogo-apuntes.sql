-- Catálogo de apuntes/libros que la imprenta ya tiene, para que el cliente
-- del sitio web pueda buscarlos y seleccionarlos en vez de subir un archivo
-- propio en el cotizador (imprimir-online.html en el proyecto Impress Web).
-- Se carga a mano desde el SQL editor / Table editor de Supabase por ahora.

CREATE TABLE IF NOT EXISTS catalogo_apuntes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria         TEXT NOT NULL,
  materia           TEXT,
  titulo            TEXT NOT NULL,
  autor_catedra     TEXT,
  paginas           INTEGER NOT NULL,
  storage_path      TEXT NOT NULL,
  precio_referencia NUMERIC(10,2),
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_apuntes_categoria ON catalogo_apuntes(categoria);
CREATE INDEX IF NOT EXISTS idx_catalogo_apuntes_activo ON catalogo_apuntes(activo);

ALTER TABLE catalogo_apuntes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados leen" ON catalogo_apuntes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "usuarios autenticados escriben" ON catalogo_apuntes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- El sitio público (Impress Web) lee/escribe esta tabla con la service-role
-- key desde sus funciones serverless, así que las policies de arriba no lo
-- afectan (bypassa RLS) — son para poder ver/editar desde Supabase Studio
-- o, a futuro, desde una pantalla de impress-pedidos.
