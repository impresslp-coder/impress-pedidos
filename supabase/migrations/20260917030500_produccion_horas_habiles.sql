-- Flujo de Producción: responsable, plazo de 24 horas hábiles y sucursales.

INSERT INTO public.sucursales_retiro (codigo, nombre, direccion, horario, activa) VALUES
  ('60', 'Sucursal 60', 'Av. 60 N° 1343 entre 21 y 22, La Plata', 'Lunes a viernes de 9 a 18 hs', TRUE),
  ('44', 'Sucursal 44', 'Av. 44 N° 1685 entre 28 y 29, La Plata', 'Lunes a viernes de 9 a 18 hs', TRUE),
  ('41', 'Sucursal 41', '41 N° 1376 e 22 y 23', 'Lunes a viernes de 9 a 18 hs', TRUE)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  direccion = EXCLUDED.direccion,
  horario = EXCLUDED.horario,
  activa = EXCLUDED.activa;

INSERT INTO public.horarios_sucursal (sucursal, dia_semana, abre, cierra)
SELECT s.codigo, d, TIME '09:00', TIME '18:00'
FROM public.sucursales_retiro s
CROSS JOIN generate_series(1, 5) d
ON CONFLICT (sucursal, dia_semana) DO UPDATE
SET abre = EXCLUDED.abre, cierra = EXCLUDED.cierra;

INSERT INTO public.configuracion (clave, valor)
VALUES ('produccion_horas_plazo', '24')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS produccion_por         UUID REFERENCES public.usuarios_sistema(id),
  ADD COLUMN IF NOT EXISTS produccion_iniciada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS produccion_vence_en    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS produccion_terminada_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pedidos_produccion_vencida
  ON public.pedidos (produccion_vence_en)
  WHERE estado = 'produccion' AND produccion_terminada_en IS NULL;

CREATE TABLE IF NOT EXISTS public.recordatorios_produccion (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  enviado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  destinatario UUID REFERENCES public.usuarios_sistema(id),
  motivo       TEXT NOT NULL DEFAULT 'produccion vencida'
);

CREATE OR REPLACE FUNCTION public.sumar_horas_habiles(
  p_desde TIMESTAMPTZ,
  p_horas NUMERIC,
  p_sucursal TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cursor TIMESTAMPTZ := p_desde;
  v_restantes NUMERIC := p_horas;
  v_local TIMESTAMP;
  v_fecha DATE;
  v_horario RECORD;
  v_inicio TIMESTAMP;
  v_fin TIMESTAMP;
  v_disponibles NUMERIC;
  v_iteraciones INT := 0;
BEGIN
  IF p_desde IS NULL OR p_sucursal IS NULL OR btrim(p_sucursal) = '' THEN
    RAISE EXCEPTION 'Se requiere fecha inicial y sucursal para calcular el vencimiento de producción.';
  END IF;
  IF p_horas IS NULL OR p_horas < 0 THEN
    RAISE EXCEPTION 'Las horas hábiles deben ser un número no negativo.';
  END IF;
  IF p_horas = 0 THEN RETURN p_desde; END IF;

  WHILE v_restantes > 0 LOOP
    v_iteraciones := v_iteraciones + 1;
    IF v_iteraciones > 400 THEN
      RAISE EXCEPTION 'No se encontró suficiente horario hábil para la sucursal %.', p_sucursal;
    END IF;

    v_local := v_cursor AT TIME ZONE 'America/Argentina/Buenos_Aires';
    v_fecha := v_local::date;
    SELECT hs.abre, hs.cierra INTO v_horario
    FROM public.horarios_sucursal hs
    WHERE hs.sucursal = p_sucursal
      AND hs.dia_semana = extract(dow FROM v_fecha)::int
      AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.fecha = v_fecha);

    IF NOT FOUND THEN
      v_cursor := ((v_fecha + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
      CONTINUE;
    END IF;

    v_inicio := greatest(v_local, v_fecha + v_horario.abre);
    v_fin := v_fecha + v_horario.cierra;
    IF v_inicio >= v_fin THEN
      v_cursor := ((v_fecha + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
      CONTINUE;
    END IF;

    v_disponibles := extract(epoch FROM (v_fin - v_inicio)) / 3600;
    IF v_restantes <= v_disponibles THEN
      RETURN (v_inicio + (v_restantes * INTERVAL '1 hour')) AT TIME ZONE 'America/Argentina/Buenos_Aires';
    END IF;

    v_restantes := v_restantes - v_disponibles;
    v_cursor := ((v_fecha + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  END LOOP;

  RETURN v_cursor;
END;
$$;

CREATE OR REPLACE FUNCTION public.tomar_pedido_en_produccion(
  p_pedido_id UUID,
  p_usuario_id UUID
)
RETURNS TABLE (vence_en TIMESTAMPTZ)
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
  IF v_pedido.estado <> 'pedidos' THEN
    RAISE EXCEPTION 'El pedido debe estar en estado Pedidos para comenzar producción.';
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
  SET estado = 'produccion',
      produccion_por = p_usuario_id,
      produccion_iniciada_en = NOW(),
      produccion_vence_en = v_vence,
      produccion_terminada_en = NULL
  WHERE id = p_pedido_id;

  RETURN QUERY SELECT v_vence;
END;
$$;

REVOKE ALL ON FUNCTION public.tomar_pedido_en_produccion(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tomar_pedido_en_produccion(UUID, UUID) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
