-- Los CSV conservan códigos técnicos y etiquetas operativas. La aplicación
-- trabaja con las etiquetas visibles para que la operación use un solo vocabulario.
UPDATE public.pedidos
SET estado = CASE estado
  WHEN 'encargos' THEN 'Encargo recibido'
  WHEN 'entrega' THEN 'Listo para entregar'
  WHEN 'pedidos' THEN 'Encargo recibido'
  WHEN 'produccion' THEN 'En producción'
  WHEN 'finalizados' THEN 'Entregado'
  WHEN 'cancelado' THEN 'Cancelado'
  ELSE estado
END
WHERE estado IN ('encargos', 'entrega', 'pedidos', 'produccion', 'finalizados', 'cancelado');

UPDATE public.estados_pedido
SET nombre = CASE codigo
  WHEN 'pedidos' THEN 'Encargo recibido'
  WHEN 'encargos' THEN 'Encargo recibido'
  WHEN 'produccion' THEN 'En producción'
  WHEN 'entrega' THEN 'Listo para entregar'
  WHEN 'finalizados' THEN 'Entregado'
  WHEN 'cancelado' THEN 'Cancelado'
  ELSE nombre
END;

CREATE OR REPLACE FUNCTION public.tomar_pedido_en_produccion(
  p_pedido_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE(vence_en TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos%ROWTYPE;
  v_horas NUMERIC;
  v_vence TIMESTAMPTZ;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_usuario_id THEN
    RAISE EXCEPTION 'Solo podés tomar producción a tu nombre.';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado.'; END IF;
  IF v_pedido.estado <> 'Encargo recibido' THEN
    RAISE EXCEPTION 'El pedido debe estar en estado Encargo recibido para comenzar producción.';
  END IF;
  IF coalesce(btrim(v_pedido.sucursal_produccion), '') = '' THEN
    RAISE EXCEPTION 'El pedido no tiene sucursal de producción.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios_sistema u WHERE u.id = p_usuario_id AND u.activo) THEN
    RAISE EXCEPTION 'El usuario que toma la producción no está activo.';
  END IF;

  SELECT nullif(valor, '')::numeric INTO v_horas
  FROM public.configuracion WHERE clave = 'produccion_horas_plazo';
  IF v_horas IS NULL OR v_horas <= 0 THEN
    RAISE EXCEPTION 'Configuración produccion_horas_plazo inválida.';
  END IF;

  v_vence := public.sumar_horas_habiles(NOW(), v_horas, v_pedido.sucursal_produccion);
  UPDATE public.pedidos
  SET estado = 'En producción',
      produccion_por = p_usuario_id,
      produccion_iniciada_en = NOW(),
      produccion_vence_en = v_vence,
      produccion_terminada_en = NULL
  WHERE id = p_pedido_id;

  RETURN QUERY SELECT v_vence;
END;
$$;

NOTIFY pgrst, 'reload schema';
