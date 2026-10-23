-- Identifica al operador que confirma la impresión desde IMPRESS Print.

ALTER TABLE public.tickets_pedido
  ADD COLUMN IF NOT EXISTS impreso_por UUID REFERENCES public.usuarios_sistema(id);

CREATE INDEX IF NOT EXISTS idx_tickets_pedido_impreso_por
  ON public.tickets_pedido (impreso_por)
  WHERE impreso_por IS NOT NULL;

COMMENT ON COLUMN public.tickets_pedido.impreso_por IS
  'Operador validado en IMPRESS Print que confirmó la impresión del ticket.';

NOTIFY pgrst, 'reload schema';
