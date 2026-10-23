-- Avisos operativos para pedidos de producción vencidos.
-- El cron de la aplicación inserta un registro por destinatario y nivel de aviso.

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios_sistema(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  detalle TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  leida_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_pendientes
  ON public.notificaciones (usuario_id, creado_en DESC)
  WHERE leida_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordatorios_produccion_pedido_destinatario
  ON public.recordatorios_produccion (pedido_id, destinatario, enviado_en DESC);

COMMENT ON TABLE public.notificaciones IS
  'Avisos internos visibles para cada usuario. No almacena ni envía enlaces de WhatsApp.';
