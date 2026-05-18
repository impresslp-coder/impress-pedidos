-- Estadisticas de impresion registradas por IMPRESS Print.
-- Correr en Supabase SQL Editor antes de usar el panel de metricas.

CREATE TABLE IF NOT EXISTS pedido_print_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  archivo_id UUID REFERENCES archivos_pedido(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'ticket')),
  ticket_type TEXT CHECK (ticket_type IN ('pedido', 'entrega')),
  job_name TEXT,
  printer_name TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  paginas_impresas INTEGER NOT NULL DEFAULT 0,
  hojas_estimadas INTEGER NOT NULL DEFAULT 0,
  copias INTEGER NOT NULL DEFAULT 1,
  paper_name TEXT,
  duplex_mode TEXT,
  color BOOLEAN DEFAULT FALSE,
  page_ranges TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_print_events_pedido
  ON pedido_print_events(pedido_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedido_print_events_archivo
  ON pedido_print_events(archivo_id);

ALTER TABLE pedido_print_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios autenticados leen print events" ON pedido_print_events;
CREATE POLICY "usuarios autenticados leen print events"
  ON pedido_print_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "usuarios autenticados escriben print events" ON pedido_print_events;
CREATE POLICY "usuarios autenticados escriben print events"
  ON pedido_print_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
