-- El motor debe devolver estrictamente precio_por_hoja × hojas. El catálogo
-- fue cargado con esa regla y el redondeo global posterior generaba diferencias
-- contra sus precios auditados (por ejemplo $24.500 se convertía en $24.600).
CREATE OR REPLACE FUNCTION precio_impresion(
  p_tipo_papel text,
  p_tamano text,
  p_hojas int
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE v_precio_por_hoja numeric;
BEGIN
  IF p_hojas < 1 THEN
    RAISE EXCEPTION 'Las hojas deben ser mayores que cero';
  END IF;

  SELECT pi.precio_por_hoja INTO v_precio_por_hoja
  FROM precios_impresion pi
  WHERE pi.tipo_papel = lower(p_tipo_papel)
    AND pi.tamano = upper(p_tamano)
    AND pi.activo
    AND pi.vigente_desde <= current_date
    AND (pi.vigente_hasta IS NULL OR pi.vigente_hasta >= current_date)
    AND pi.hojas_desde <= p_hojas
    AND (pi.hojas_hasta IS NULL OR pi.hojas_hasta >= p_hojas)
  ORDER BY pi.vigente_desde DESC, pi.hojas_desde DESC
  LIMIT 1;

  IF v_precio_por_hoja IS NULL THEN
    RAISE EXCEPTION 'No hay precio vigente para papel %, tamaño % y % hojas', p_tipo_papel, p_tamano, p_hojas;
  END IF;

  RETURN v_precio_por_hoja * p_hojas;
END;
$$;
