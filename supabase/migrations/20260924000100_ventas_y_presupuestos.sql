-- Los presupuestos originados en caja conservan los mismos ítems que se cobrarán
-- después. La relación queda en ventas para poder seguir una venta desde su origen.
ALTER TABLE public.presupuestos
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'vigente'
    CHECK (estado IN ('vigente', 'convertido', 'vencido', 'cancelado'));

ALTER TABLE public.items_presupuesto
  ADD COLUMN IF NOT EXISTS producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS presupuesto_id uuid REFERENCES public.presupuestos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ventas_presupuesto_id_unico
  ON public.ventas (presupuesto_id)
  WHERE presupuesto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS presupuestos_estado_fecha_idx
  ON public.presupuestos (estado, fecha_vencimiento);
