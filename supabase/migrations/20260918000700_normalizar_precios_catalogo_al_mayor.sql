-- Auditoría 2026-09-18: los 796 valores distintos del catálogo estaban $100
-- por debajo del precio vigente del motor. Por decisión operativa se conserva
-- siempre el mayor importe registrado, sin afectar servicios ni acabados.
WITH precios_motor AS (
  SELECT
    p.id,
    precio_impresion('comun', 'A4', hojas_de(p.paginas)) AS precio_calculado
  FROM productos p
  WHERE p.tipo = 'encargo'
    AND p.es_servicio = false
    AND p.origen_fila IS NOT NULL
    AND p.paginas IS NOT NULL
)
UPDATE productos p
SET precio = GREATEST(p.precio, pm.precio_calculado)
FROM precios_motor pm
WHERE p.id = pm.id
  AND p.precio < pm.precio_calculado;
