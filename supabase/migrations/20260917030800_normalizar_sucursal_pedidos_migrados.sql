-- Los pedidos importados conservan las sucursales de producción y retiro con
-- códigos numéricos. La vista operativa histórica usa pedidos.sucursal.
-- Se completa esa columna sin reemplazar los datos de origen.
UPDATE public.pedidos
SET sucursal = CASE coalesce(nullif(btrim(sucursal_retiro), ''), nullif(btrim(sucursal_produccion), ''))
  WHEN '41' THEN 'Sucursal 41'
  WHEN '44' THEN 'Sucursal 44'
  WHEN '60' THEN 'Sucursal 60'
END
WHERE sucursal IS NULL
  AND coalesce(nullif(btrim(sucursal_retiro), ''), nullif(btrim(sucursal_produccion), '')) IN ('41', '44', '60');
