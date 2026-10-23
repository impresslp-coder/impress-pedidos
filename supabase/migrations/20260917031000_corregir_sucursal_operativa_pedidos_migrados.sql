-- La sucursal operativa de un pedido recibido es la sucursal de producción.
-- La migración inicial completó pedidos.sucursal con sucursal_retiro, lo que
-- hacía que los pedidos con retiro en otra sucursal parecieran no estar en la
-- sucursal que los recibió. Solo se reemplaza el valor que la propia
-- migración anterior calculó automáticamente; un traslado manual posterior
-- conserva su sucursal actual.
UPDATE public.pedidos p
SET sucursal = CASE nullif(btrim(p.sucursal_produccion), '')
  WHEN '41' THEN 'Sucursal 41'
  WHEN '44' THEN 'Sucursal 44'
  WHEN '60' THEN 'Sucursal 60'
END
WHERE p.origen_filas IS NOT NULL
  AND nullif(btrim(p.sucursal_produccion), '') IN ('41', '44', '60')
  AND (
    p.sucursal IS NULL
    OR p.sucursal = CASE nullif(btrim(p.sucursal_retiro), '')
      WHEN '41' THEN 'Sucursal 41'
      WHEN '44' THEN 'Sucursal 44'
      WHEN '60' THEN 'Sucursal 60'
    END
  );
