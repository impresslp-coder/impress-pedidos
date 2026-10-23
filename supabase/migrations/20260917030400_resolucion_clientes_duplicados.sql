-- Resoluciones auditables para nombres de clientes duplicados en la migración.
-- La única elección manual fue confirmada por Nicolás el 17/09/2026.

CREATE TABLE IF NOT EXISTS staging.resoluciones_cliente_pedidos (
  numero_pedido TEXT PRIMARY KEY,
  cliente_codigo TEXT NOT NULL,
  motivo         TEXT NOT NULL,
  decidido_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO staging.resoluciones_cliente_pedidos (numero_pedido, cliente_codigo, motivo)
VALUES ('4248', 'SER642LOS', 'Confirmado por Nicolás: Sergio Avalos corresponde a SER642LOS')
ON CONFLICT (numero_pedido) DO UPDATE
SET cliente_codigo = EXCLUDED.cliente_codigo,
    motivo = EXCLUDED.motivo;

CREATE OR REPLACE FUNCTION public.resolver_cliente_id_migracion(
  p_numero_pedido TEXT,
  p_nombre TEXT,
  p_telefono TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_cliente_id UUID;
  v_candidatos INT;
  v_por_telefono INT;
BEGIN
  SELECT c.id INTO v_cliente_id
  FROM staging.resoluciones_cliente_pedidos r
  JOIN public.clientes c ON c.codigo = r.cliente_codigo
  WHERE r.numero_pedido = btrim(p_numero_pedido);
  IF v_cliente_id IS NOT NULL THEN RETURN v_cliente_id; END IF;

  SELECT count(*) INTO v_candidatos
  FROM public.clientes c
  WHERE public.normalizar_texto(c.nombre) = public.normalizar_texto(p_nombre);
  IF v_candidatos = 1 THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE public.normalizar_texto(c.nombre) = public.normalizar_texto(p_nombre);
    RETURN v_cliente_id;
  END IF;

  SELECT count(*) INTO v_por_telefono
  FROM public.clientes c
  WHERE public.normalizar_texto(c.nombre) = public.normalizar_texto(p_nombre)
    AND regexp_replace(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), '^549', '') =
        regexp_replace(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), '^549', '');
  IF v_por_telefono = 1 THEN
    SELECT c.id INTO v_cliente_id
    FROM public.clientes c
    WHERE public.normalizar_texto(c.nombre) = public.normalizar_texto(p_nombre)
      AND regexp_replace(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), '^549', '') =
          regexp_replace(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), '^549', '');
    RETURN v_cliente_id;
  END IF;

  RAISE EXCEPTION 'No hay una resolución única para el pedido %, cliente %', p_numero_pedido, p_nombre;
END;
$$;

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

  -- No se continúa si un nombre no tiene una resolución única o verificable.
  PERFORM public.resolver_cliente_id_migracion(r.numero, r.cliente_nombre, r.telefono)
  FROM staging.pedidos_raw r;

  INSERT INTO public.pedidos (
    numero, numero_origen, cliente_id, estado, prioridad, fecha_pedido,
    sucursal_produccion, sucursal_retiro, es_envio, medio_pago, via_contacto,
    total, senia, ubicacion, carpeta_url, ticket_pedido_url,
    quien_cargo_codigo, origen_filas, revisar, revisar_motivo
  )
  SELECT btrim(r.numero), btrim(r.numero), cliente.id, btrim(r.estado), 'normal',
    to_timestamp(btrim(r.fecha), 'DD/MM/YYYY HH24:MI'),
    nullif(btrim(r.sucursal_produccion), ''), nullif(btrim(r.sucursal_retiro), ''),
    lower(btrim(r.es_envio)) = 'true', nullif(btrim(r.medio_pago), ''),
    nullif(btrim(r.via_contacto), ''), nullif(btrim(r.total), '')::numeric,
    coalesce(nullif(btrim(r.sena), '')::numeric, 0), nullif(btrim(r.ubicacion), ''),
    nullif(btrim(r.archivo), ''), nullif(btrim(r.ticket), ''),
    nullif(btrim(r.quien_cargo), ''), btrim(r.filas_origen), FALSE, NULL
  FROM staging.pedidos_raw r
  CROSS JOIN LATERAL (
    SELECT public.resolver_cliente_id_migracion(r.numero, r.cliente_nombre, r.telefono) AS id
  ) cliente
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

REVOKE ALL ON FUNCTION public.resolver_cliente_id_migracion(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrar_pedidos_desde_staging() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrar_pedidos_desde_staging() TO service_role;
NOTIFY pgrst, 'reload schema';
