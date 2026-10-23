-- Corrige la normalización del teléfono en la transformación de clientes nuevos.
-- La migración anterior ya creó la función; se la reemplaza sin tocar staging ni datos.

CREATE OR REPLACE FUNCTION public.migrar_pedidos_desde_staging()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_clientes_creados INT;
  v_pedidos INT;
  v_items INT;
  v_sin_cliente INT;
BEGIN
  PERFORM public.validar_staging_pedidos();

  IF EXISTS (
    SELECT 1
    FROM staging.clientes_nuevos_raw r
    CROSS JOIN LATERAL (
      SELECT upper(
        left(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3) ||
        right(regexp_replace(regexp_replace(r.telefono, '\D', '', 'g'), '^549', ''), 3) ||
        right(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3)
      ) AS codigo
    ) codigo_generado
    JOIN public.clientes existente ON existente.codigo = codigo_generado.codigo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.clientes mismo
      WHERE public.normalizar_texto(mismo.nombre) = public.normalizar_texto(r.nombre)
    )
  ) THEN
    RAISE EXCEPTION 'Colisión de código al crear clientes nuevos; requiere revisión manual.';
  END IF;

  INSERT INTO public.clientes (codigo, nombre, cod_pais, telefono, activo, revisar, revisar_motivo)
  SELECT
    upper(
      left(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3) ||
      right(regexp_replace(regexp_replace(r.telefono, '\D', '', 'g'), '^549', ''), 3) ||
      right(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3)
    ),
    btrim(r.nombre),
    CASE WHEN regexp_replace(r.telefono, '\D', '', 'g') LIKE '549%' THEN '549' ELSE '54' END,
    nullif(regexp_replace(regexp_replace(r.telefono, '\D', '', 'g'), '^549', ''), ''),
    TRUE,
    TRUE,
    CASE WHEN lower(btrim(r.hay_telefono_igual_en_clientes)) = 'true'
      THEN 'telefono coincide con otro cliente - verificar si es la misma persona'
      ELSE 'alta desde migracion de pedidos'
    END
  FROM staging.clientes_nuevos_raw r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE public.normalizar_texto(c.nombre) = public.normalizar_texto(r.nombre)
  );
  GET DIAGNOSTICS v_clientes_creados = ROW_COUNT;

  SELECT count(*) INTO v_sin_cliente
  FROM staging.pedidos_raw r
  LEFT JOIN public.clientes c
    ON public.normalizar_texto(c.nombre) = public.normalizar_texto(r.cliente_nombre)
  WHERE c.id IS NULL;
  IF v_sin_cliente <> 0 THEN RAISE EXCEPTION '% pedidos quedaron sin cliente', v_sin_cliente; END IF;

  INSERT INTO public.pedidos (
    numero, numero_origen, cliente_id, estado, prioridad, fecha_pedido,
    sucursal_produccion, sucursal_retiro, es_envio, medio_pago, via_contacto,
    total, senia, ubicacion, carpeta_url, ticket_pedido_url,
    quien_cargo_codigo, origen_filas, revisar, revisar_motivo
  )
  SELECT btrim(r.numero), btrim(r.numero), c.id, btrim(r.estado), 'normal',
    to_timestamp(btrim(r.fecha), 'DD/MM/YYYY HH24:MI'),
    nullif(btrim(r.sucursal_produccion), ''), nullif(btrim(r.sucursal_retiro), ''),
    lower(btrim(r.es_envio)) = 'true', nullif(btrim(r.medio_pago), ''),
    nullif(btrim(r.via_contacto), ''), nullif(btrim(r.total), '')::numeric,
    coalesce(nullif(btrim(r.sena), '')::numeric, 0), nullif(btrim(r.ubicacion), ''),
    nullif(btrim(r.archivo), ''), nullif(btrim(r.ticket), ''),
    nullif(btrim(r.quien_cargo), ''), btrim(r.filas_origen), FALSE, NULL
  FROM staging.pedidos_raw r
  JOIN public.clientes c ON public.normalizar_texto(c.nombre) = public.normalizar_texto(r.cliente_nombre)
  ON CONFLICT (numero) DO UPDATE SET
    cliente_id = EXCLUDED.cliente_id, estado = EXCLUDED.estado, total = EXCLUDED.total,
    senia = EXCLUDED.senia, fecha_pedido = EXCLUDED.fecha_pedido,
    sucursal_produccion = EXCLUDED.sucursal_produccion, sucursal_retiro = EXCLUDED.sucursal_retiro,
    es_envio = EXCLUDED.es_envio, medio_pago = EXCLUDED.medio_pago, via_contacto = EXCLUDED.via_contacto,
    ubicacion = EXCLUDED.ubicacion, carpeta_url = EXCLUDED.carpeta_url,
    ticket_pedido_url = EXCLUDED.ticket_pedido_url, quien_cargo_codigo = EXCLUDED.quien_cargo_codigo,
    origen_filas = EXCLUDED.origen_filas;
  GET DIAGNOSTICS v_pedidos = ROW_COUNT;

  DELETE FROM public.items_pedido i
  USING public.pedidos p
  WHERE i.pedido_id = p.id
    AND p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw);

  INSERT INTO public.items_pedido (
    pedido_id, orden, producto, paginas, modo, anillado, cantidad,
    precio_unitario, precio, anotacion, origen_filas, prioridad
  )
  SELECT p.id, btrim(i.orden)::int, btrim(i.producto), btrim(i.paginas)::int,
    nullif(btrim(i.modo), ''), lower(btrim(i.anillado)) = 'true', btrim(i.cantidad)::int,
    btrim(i.precio_unitario)::numeric, btrim(i.subtotal)::numeric,
    nullif(btrim(i.anotacion), ''), btrim(i.filas_origen), 'normal'
  FROM staging.items_raw i
  JOIN public.pedidos p ON p.numero = btrim(i.numero_pedido);
  GET DIAGNOSTICS v_items = ROW_COUNT;

  UPDATE public.pedidos p SET revisar = TRUE,
    revisar_motivo = 'la planilla decia PRIORIDAD ALTA en Anotaciones - que un supervisor la suba'
  WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)
    AND EXISTS (
      SELECT 1 FROM public.items_pedido i
      WHERE i.pedido_id = p.id AND upper(coalesce(i.anotacion, '')) LIKE '%PRIORIDAD%'
    );

  RETURN jsonb_build_object('clientes_creados', v_clientes_creados, 'pedidos_afectados', v_pedidos, 'items_insertados', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_pedidos_desde_staging() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrar_pedidos_desde_staging() TO service_role;
NOTIFY pgrst, 'reload schema';
