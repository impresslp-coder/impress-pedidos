-- Pedidos históricos: los ítems repetidos de la planilla se consolidan con cantidad.
-- Aditiva e idempotente. Ejecutar antes de 20260917_004_staging_pedidos.sql.

ALTER TABLE public.items_pedido
  ADD COLUMN IF NOT EXISTS cantidad        INT           NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS orden           INT,
  ADD COLUMN IF NOT EXISTS anillado        BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS origen_filas    TEXT,
  ADD COLUMN IF NOT EXISTS prioridad       TEXT          NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN public.items_pedido.cantidad IS
  'La planilla histórica repetía una fila por unidad; aquí el ítem queda consolidado.';
COMMENT ON COLUMN public.items_pedido.precio IS
  'Subtotal del ítem: precio_unitario por cantidad.';
COMMENT ON COLUMN public.items_pedido.origen_filas IS
  'Filas del CSV de origen que dieron este ítem, separadas por espacio.';

CREATE TABLE IF NOT EXISTS public.prioridades (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden  INT  NOT NULL,
  color  TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.prioridades (codigo, nombre, orden, color) VALUES
  ('baja',   'Baja',   1, 'gris'),
  ('normal', 'Normal', 2, 'azul'),
  ('alta',   'Alta',   3, 'rojo')
ON CONFLICT (codigo) DO NOTHING;
