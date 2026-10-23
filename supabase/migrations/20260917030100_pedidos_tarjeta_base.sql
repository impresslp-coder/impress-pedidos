-- Base aditiva para la tarjeta de pedidos y la migración de pendientes.
-- No agrega todavía FK sobre estado/sucursal: la app vigente aún emite estados
-- heredados y faltan las direcciones confirmadas para las sucursales de retiro.

CREATE TABLE IF NOT EXISTS public.estados_pedido (
  codigo   TEXT PRIMARY KEY,
  nombre   TEXT NOT NULL,
  orden    INT  NOT NULL,
  es_final BOOLEAN NOT NULL DEFAULT FALSE,
  activo   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.estados_pedido (codigo, nombre, orden, es_final) VALUES
  ('pedidos',     'Pedidos',     1, FALSE),
  ('encargos',    'Encargos',    2, FALSE),
  ('produccion',  'Producción',  3, FALSE),
  ('entrega',     'Entrega',     4, FALSE),
  ('finalizados', 'Finalizados', 5, TRUE),
  ('cancelado',   'Cancelado',   6, TRUE)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero_origen             TEXT,
  ADD COLUMN IF NOT EXISTS origen_filas              TEXT,
  ADD COLUMN IF NOT EXISTS fecha_pedido              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS es_envio                  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ubicacion_actualizada_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ticket_pedido_url         TEXT,
  ADD COLUMN IF NOT EXISTS total                     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS revisar                   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revisar_motivo            TEXT,
  ADD COLUMN IF NOT EXISTS terciarizado_id           UUID REFERENCES public.terciarizados(id);

CREATE INDEX IF NOT EXISTS idx_pedidos_revisar
  ON public.pedidos (revisar) WHERE revisar;
CREATE INDEX IF NOT EXISTS idx_pedidos_numero_origen
  ON public.pedidos (numero_origen) WHERE numero_origen IS NOT NULL;

-- La dirección se completa con los datos confirmados antes de activar WhatsApp.
CREATE TABLE IF NOT EXISTS public.sucursales_retiro (
  codigo    TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  direccion TEXT NOT NULL,
  horario   TEXT,
  activa    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.plantillas_mensaje (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  estado TEXT REFERENCES public.estados_pedido(codigo),
  cuerpo TEXT NOT NULL,
  orden  INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.mensajes_enviados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  plantilla   TEXT,
  enviado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_por UUID REFERENCES public.usuarios_sistema(id)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_enviados_pedido
  ON public.mensajes_enviados (pedido_id, enviado_en DESC);

CREATE TABLE IF NOT EXISTS public.tickets_pedido (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('pedido', 'entrega', 'resumen')),
  generado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generado_por UUID REFERENCES public.usuarios_sistema(id),
  impreso      BOOLEAN NOT NULL DEFAULT FALSE,
  impreso_en   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.horarios_sucursal (
  sucursal   TEXT NOT NULL REFERENCES public.sucursales_retiro(codigo),
  dia_semana INT  NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  abre       TIME NOT NULL,
  cierra     TIME NOT NULL CHECK (cierra > abre),
  PRIMARY KEY (sucursal, dia_semana)
);

CREATE TABLE IF NOT EXISTS public.feriados (
  fecha  DATE PRIMARY KEY,
  nombre TEXT
);
