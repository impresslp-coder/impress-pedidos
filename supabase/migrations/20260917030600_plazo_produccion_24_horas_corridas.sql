-- Decisión de Nicolás (17/09/2026): Producción vence a las 24 horas corridas.
-- No se descuentan horarios de apertura, cierres, fines de semana ni feriados.

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
BEGIN
  IF p_desde IS NULL THEN
    RAISE EXCEPTION 'Se requiere fecha inicial para calcular el vencimiento de producción.';
  END IF;
  IF p_horas IS NULL OR p_horas < 0 THEN
    RAISE EXCEPTION 'Las horas de producción deben ser un número no negativo.';
  END IF;
  RETURN p_desde + (p_horas * INTERVAL '1 hour');
END;
$$;

COMMENT ON FUNCTION public.sumar_horas_habiles(TIMESTAMPTZ, NUMERIC, TEXT) IS
  'Compatibilidad de nombre: por decisión operativa el plazo de Producción usa horas corridas.';
