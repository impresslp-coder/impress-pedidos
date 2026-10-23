-- A5 se cobra con los mismos tramos que A4, como en la calculadora web.
-- Se copian los precios vigentes; luego pueden ajustarse por separado desde
-- Admin > Precios sin modificar A4 ni el historial existente.
BEGIN;

ALTER TABLE precios_impresion
  DROP CONSTRAINT IF EXISTS precios_impresion_tamano_check;

ALTER TABLE precios_impresion
  ADD CONSTRAINT precios_impresion_tamano_check
  CHECK (tamano IN ('A3', 'A4', 'A5'));

INSERT INTO precios_impresion
  (tipo_papel, tamano, hojas_desde, hojas_hasta, precio_por_hoja,
   vigente_desde, vigente_hasta, activo)
SELECT a4.tipo_papel, 'A5', a4.hojas_desde, a4.hojas_hasta,
       a4.precio_por_hoja, current_date, NULL, true
FROM precios_impresion AS a4
WHERE a4.tamano = 'A4'
  AND a4.activo
  AND a4.vigente_desde <= current_date
  AND (a4.vigente_hasta IS NULL OR a4.vigente_hasta >= current_date)
  AND NOT EXISTS (
    SELECT 1 FROM precios_impresion AS a5
    WHERE a5.tipo_papel = a4.tipo_papel
      AND a5.tamano = 'A5'
      AND a5.hojas_desde = a4.hojas_desde
      AND a5.activo
  );

COMMIT;
