-- Tarifa de impresión en papel común confirmada por el negocio:
-- A5 $75, A4 $150, A3 $300 por hoja física, sin diferencia por
-- simple/doble faz ni por color/B&N. Los papeles especiales conservan
-- sus tarifas. Se cierran las filas anteriores para preservar historial.
BEGIN;

UPDATE precios_impresion
SET activo = false,
    vigente_hasta = GREATEST(vigente_desde, current_date - 1)
WHERE tipo_papel = 'comun'
  AND tamano IN ('A3', 'A4', 'A5')
  AND activo;

INSERT INTO precios_impresion
  (tipo_papel, tamano, hojas_desde, hojas_hasta, precio_por_hoja,
   vigente_desde, vigente_hasta, activo)
VALUES
  ('comun', 'A3', 1, NULL, 300, current_date, NULL, true),
  ('comun', 'A4', 1, NULL, 150, current_date, NULL, true),
  ('comun', 'A5', 1, NULL, 75, current_date, NULL, true);

-- El precio por hoja debe conservar los $75 de A5 y los $150 de A4.
-- El redondeo anterior a centenas alteraba los pedidos pequeños.
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

COMMIT;
