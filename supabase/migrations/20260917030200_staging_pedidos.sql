-- Carga idempotente de pedidos pendientes.
-- El cliente inserta solo texto crudo en staging; toda transformación ocurre aquí.

CREATE SCHEMA IF NOT EXISTS staging;
REVOKE ALL ON SCHEMA staging FROM PUBLIC;

CREATE TABLE IF NOT EXISTS staging.pedidos_raw (
  numero TEXT, cliente_nombre TEXT, telefono TEXT, fecha TEXT,
  estado TEXT, estado_planilla TEXT, prioridad TEXT,
  sucursal_produccion TEXT, sucursal_retiro TEXT, es_envio TEXT,
  medio_pago TEXT, via_contacto TEXT, total TEXT, sena TEXT, saldo TEXT,
  paginas TEXT, items_filas TEXT, ubicacion TEXT, quien_cargo TEXT,
  quien_lo_hizo TEXT, archivo TEXT, ticket TEXT, filas_origen TEXT
);

CREATE TABLE IF NOT EXISTS staging.items_raw (
  numero_pedido TEXT, orden TEXT, producto TEXT, paginas TEXT, modo TEXT,
  anillado TEXT, cantidad TEXT, precio_unitario TEXT, subtotal TEXT,
  anotacion TEXT, filas_origen TEXT
);

CREATE TABLE IF NOT EXISTS staging.clientes_nuevos_raw (
  nombre TEXT, telefono TEXT, hay_telefono_igual_en_clientes TEXT,
  pedido TEXT, sucursal TEXT, fecha_pedido TEXT
);

CREATE OR REPLACE FUNCTION public.normalizar_texto(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    translate(lower(btrim(coalesce(p_texto, ''))),
      'áàäâéèëêíìïîóòöôúùüûñ',
      'aaaaeeeeiiiioooouuuun'),
    '\s+', ' ', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.reemplazar_staging_pedidos(
  p_pedidos JSONB,
  p_items JSONB,
  p_clientes_nuevos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_pedidos INT;
  v_items INT;
  v_clientes INT;
BEGIN
  IF jsonb_typeof(p_pedidos) <> 'array'
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_typeof(p_clientes_nuevos) <> 'array' THEN
    RAISE EXCEPTION 'El staging de pedidos requiere tres arreglos JSON.';
  END IF;

  TRUNCATE staging.items_raw, staging.pedidos_raw, staging.clientes_nuevos_raw;

  INSERT INTO staging.pedidos_raw
  SELECT * FROM jsonb_to_recordset(p_pedidos) AS r(
    numero TEXT, cliente_nombre TEXT, telefono TEXT, fecha TEXT,
    estado TEXT, estado_planilla TEXT, prioridad TEXT,
    sucursal_produccion TEXT, sucursal_retiro TEXT, es_envio TEXT,
    medio_pago TEXT, via_contacto TEXT, total TEXT, sena TEXT, saldo TEXT,
    paginas TEXT, items_filas TEXT, ubicacion TEXT, quien_cargo TEXT,
    quien_lo_hizo TEXT, archivo TEXT, ticket TEXT, filas_origen TEXT
  );
  GET DIAGNOSTICS v_pedidos = ROW_COUNT;

  INSERT INTO staging.items_raw
  SELECT * FROM jsonb_to_recordset(p_items) AS r(
    numero_pedido TEXT, orden TEXT, producto TEXT, paginas TEXT, modo TEXT,
    anillado TEXT, cantidad TEXT, precio_unitario TEXT, subtotal TEXT,
    anotacion TEXT, filas_origen TEXT
  );
  GET DIAGNOSTICS v_items = ROW_COUNT;

  INSERT INTO staging.clientes_nuevos_raw
  SELECT * FROM jsonb_to_recordset(p_clientes_nuevos) AS r(
    nombre TEXT, telefono TEXT, hay_telefono_igual_en_clientes TEXT,
    pedido TEXT, sucursal TEXT, fecha_pedido TEXT
  );
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  RETURN jsonb_build_object('pedidos_raw', v_pedidos, 'items_raw', v_items, 'clientes_nuevos_raw', v_clientes);
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_staging_pedidos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_pedidos INT;
  v_items INT;
  v_clientes INT;
  v_huerfanos INT;
  v_desiguales INT;
BEGIN
  SELECT count(*) INTO v_pedidos FROM staging.pedidos_raw;
  SELECT count(*) INTO v_items FROM staging.items_raw;
  SELECT count(*) INTO v_clientes FROM staging.clientes_nuevos_raw;
  IF v_pedidos <> 131 THEN RAISE EXCEPTION 'pedidos_raw tiene % filas, se esperaban 131', v_pedidos; END IF;
  IF v_items <> 278 THEN RAISE EXCEPTION 'items_raw tiene % filas, se esperaban 278', v_items; END IF;
  IF v_clientes <> 7 THEN RAISE EXCEPTION 'clientes_nuevos_raw tiene % filas, se esperaban 7', v_clientes; END IF;
  IF (SELECT count(DISTINCT btrim(numero)) FROM staging.pedidos_raw) <> 131 THEN
    RAISE EXCEPTION 'Hay números de pedido repetidos o vacíos en la cabecera';
  END IF;
  SELECT count(*) INTO v_huerfanos
  FROM staging.items_raw i
  LEFT JOIN staging.pedidos_raw p ON btrim(p.numero) = btrim(i.numero_pedido)
  WHERE p.numero IS NULL;
  IF v_huerfanos <> 0 THEN RAISE EXCEPTION '% ítems no tienen cabecera', v_huerfanos; END IF;
  IF EXISTS (
    SELECT 1 FROM staging.pedidos_raw
    WHERE btrim(estado) NOT IN ('entrega', 'encargos')
       OR lower(btrim(es_envio)) NOT IN ('true', 'false')
  ) THEN RAISE EXCEPTION 'El staging contiene estado o es_envio no reconocido'; END IF;
  IF EXISTS (
    SELECT 1 FROM staging.items_raw
    WHERE btrim(cantidad) !~ '^[0-9]+$'
       OR btrim(paginas) !~ '^[0-9]+$'
       OR btrim(orden) !~ '^[0-9]+$'
       OR lower(btrim(anillado)) NOT IN ('true', 'false')
  ) THEN RAISE EXCEPTION 'El staging contiene cantidad, páginas, orden o anillado inválido'; END IF;
  SELECT count(*) INTO v_desiguales
  FROM staging.pedidos_raw p
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(nullif(btrim(i.subtotal), '')::numeric), 0) AS subtotal
    FROM staging.items_raw i WHERE btrim(i.numero_pedido) = btrim(p.numero)
  ) i ON TRUE
  WHERE abs(nullif(btrim(p.total), '')::numeric - i.subtotal) > 0.01;
  IF v_desiguales <> 0 THEN RAISE EXCEPTION '% pedidos no igualan la suma de sus ítems', v_desiguales; END IF;
  RETURN jsonb_build_object('pedidos', v_pedidos, 'items', v_items, 'clientes_nuevos', v_clientes, 'validacion', 'ok');
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
  v_sin_cliente INT;
BEGIN
  PERFORM public.validar_staging_pedidos();

  -- Códigos con la misma regla de la pantalla de alta. Ante una colisión de código
  -- se aborta: no se reemplaza ni se inventa un cliente distinto.
  IF EXISTS (
    SELECT 1
    FROM staging.clientes_nuevos_raw r
    CROSS JOIN LATERAL (
      SELECT upper(
        left(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3) ||
        right(regexp_replace(regexp_replace(r.telefono, '\D', '', 'g'), '^549', ''), 3) ||
        right(regexp_replace(btrim(r.nombre), '\s+', '', 'g'), 3)
      ) AS codigo
    ) c
    JOIN public.clientes existente ON existente.codigo = c.codigo
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

CREATE OR REPLACE FUNCTION public.verificar_migracion_pedidos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, staging
AS $$
DECLARE
  v_descuadres INT;
BEGIN
  SELECT count(*) INTO v_descuadres
  FROM (
    SELECT p.id
    FROM public.pedidos p
    JOIN public.items_pedido i ON i.pedido_id = p.id
    WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)
    GROUP BY p.id, p.total
    HAVING abs(p.total - sum(i.precio)) > 0.01
  ) AS descuadres;
  IF v_descuadres <> 0 THEN RAISE EXCEPTION '% pedidos quedaron con importes descuadrados', v_descuadres; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'pedidos', count(*),
      'items', (SELECT count(*) FROM public.items_pedido i JOIN public.pedidos p ON p.id = i.pedido_id WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)),
      'cantidad_total', (SELECT coalesce(sum(i.cantidad), 0) FROM public.items_pedido i JOIN public.pedidos p ON p.id = i.pedido_id WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)),
      'paginas', (SELECT coalesce(sum(i.paginas * i.cantidad), 0) FROM public.items_pedido i JOIN public.pedidos p ON p.id = i.pedido_id WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)),
      'filas_origen_items', (SELECT count(*) FROM public.items_pedido i JOIN public.pedidos p ON p.id = i.pedido_id CROSS JOIN LATERAL unnest(string_to_array(i.origen_filas, ' ')) fila WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)),
      'entrega', count(*) FILTER (WHERE p.estado = 'entrega'),
      'encargos', count(*) FILTER (WHERE p.estado = 'encargos'),
      'total', coalesce(sum(p.total), 0),
      'senia', coalesce(sum(p.senia), 0),
      'saldo', coalesce(sum(p.total - p.senia), 0),
      'sin_cliente', count(*) FILTER (WHERE p.cliente_id IS NULL),
      'por_sucursal_produccion', (
        SELECT coalesce(jsonb_object_agg(sucursal_produccion, cantidad), '{}'::jsonb)
        FROM (
          SELECT sucursal_produccion, count(*) AS cantidad
          FROM public.pedidos
          WHERE numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)
          GROUP BY sucursal_produccion
        ) sucursal
      ),
      'prioridad_alta_pendiente', (
        SELECT coalesce(jsonb_agg(numero ORDER BY numero), '[]'::jsonb)
        FROM public.pedidos
        WHERE numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)
          AND revisar_motivo = 'la planilla decia PRIORIDAD ALTA en Anotaciones - que un supervisor la suba'
      )
    )
    FROM public.pedidos p
    WHERE p.numero IN (SELECT btrim(numero) FROM staging.pedidos_raw)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reemplazar_staging_pedidos(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_staging_pedidos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrar_pedidos_desde_staging() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verificar_migracion_pedidos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reemplazar_staging_pedidos(JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_staging_pedidos() TO service_role;
GRANT EXECUTE ON FUNCTION public.migrar_pedidos_desde_staging() TO service_role;
GRANT EXECUTE ON FUNCTION public.verificar_migracion_pedidos() TO service_role;

NOTIFY pgrst, 'reload schema';
