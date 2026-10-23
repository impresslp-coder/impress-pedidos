-- Prioridad operativa: se define por ítem y el pedido toma siempre la mayor.
UPDATE public.items_pedido
SET prioridad = 'normal'
WHERE prioridad IS NULL OR prioridad NOT IN ('baja', 'normal', 'alta');

CREATE OR REPLACE FUNCTION public.recalcular_prioridad_pedido(p_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.pedidos p
  SET prioridad = COALESCE((
    SELECT i.prioridad
    FROM public.items_pedido i
    JOIN public.prioridades pr ON pr.codigo = i.prioridad
    WHERE i.pedido_id = p_pedido_id
    ORDER BY pr.orden DESC
    LIMIT 1
  ), 'normal')
  WHERE p.id = p_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_prioridad_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalcular_prioridad_pedido(CASE WHEN TG_OP = 'DELETE' THEN OLD.pedido_id ELSE NEW.pedido_id END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_pedido_prioridad ON public.items_pedido;
CREATE TRIGGER trg_items_pedido_prioridad
AFTER INSERT OR UPDATE OF prioridad OR DELETE ON public.items_pedido
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_prioridad_pedido();

UPDATE public.pedidos p
SET prioridad = COALESCE((
  SELECT i.prioridad
  FROM public.items_pedido i
  JOIN public.prioridades pr ON pr.codigo = i.prioridad
  WHERE i.pedido_id = p.id
  ORDER BY pr.orden DESC
  LIMIT 1
), 'normal');
