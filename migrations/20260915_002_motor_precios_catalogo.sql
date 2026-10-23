-- Motor de precios y catálogo Impress.
-- Es idempotente: puede correrse más de una vez sin duplicar datos de referencia.
-- El catálogo se ingresa mediante importar_catalogo_productos(jsonb), que primero
-- lo deposita en una tabla temporal con columnas TEXT y luego lo transforma.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS precios_impresion (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_papel text NOT NULL CHECK (tipo_papel IN ('comun', 'fotografico', 'chambril')),
  tamano text NOT NULL CHECK (tamano IN ('A4', 'A3')),
  hojas_desde int NOT NULL CHECK (hojas_desde > 0),
  hojas_hasta int CHECK (hojas_hasta IS NULL OR hojas_hasta >= hojas_desde),
  precio_por_hoja numeric(10,2) NOT NULL CHECK (precio_por_hoja >= 0),
  vigente_desde date NOT NULL DEFAULT current_date,
  vigente_hasta date,
  activo boolean NOT NULL DEFAULT true,
  CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_precios_impresion_lookup
  ON precios_impresion (tipo_papel, tamano, hojas_desde)
  WHERE activo;
-- Una versión cerrada debe poder compartir su fecha de inicio con la vigente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_precios_impresion_version
  ON precios_impresion (tipo_papel, tamano, hojas_desde)
  WHERE activo;

CREATE TABLE IF NOT EXISTS anillos (
  medida_mm int PRIMARY KEY CHECK (medida_mm > 0),
  capacidad_hojas int CHECK (capacidad_hojas > 0),
  precio numeric(10,2) CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true
);

-- Los ocho tamaños inactivos no vienen con capacidad ni precio en los CSV.
-- Se permiten NULL solamente para conservar esa ausencia de datos sin inventarlos.
ALTER TABLE anillos ALTER COLUMN capacidad_hojas DROP NOT NULL;
ALTER TABLE anillos ALTER COLUMN precio DROP NOT NULL;

CREATE TABLE IF NOT EXISTS acabados_tramos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  acabado text NOT NULL CHECK (acabado = 'anillado'),
  paginas_desde int NOT NULL CHECK (paginas_desde > 0),
  paginas_hasta int CHECK (paginas_hasta IS NULL OR paginas_hasta >= paginas_desde),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acabados_tramos_inicio
  ON acabados_tramos (acabado, paginas_desde);

CREATE TABLE IF NOT EXISTS acabados_fijos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  acabado text NOT NULL CHECK (acabado = 'encuadernado'),
  tamano text NOT NULL CHECK (tamano IN ('A4', 'A3')),
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true,
  UNIQUE (acabado, tamano)
);

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS es_servicio boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS origen_fila int,
  ADD COLUMN IF NOT EXISTS anillo_mm int REFERENCES anillos(medida_mm),
  ADD COLUMN IF NOT EXISTS anillos_cant int,
  ADD COLUMN IF NOT EXISTS revisar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS revisar_motivo text,
  ADD COLUMN IF NOT EXISTS carrera text,
  ADD COLUMN IF NOT EXISTS materia text;

CREATE INDEX IF NOT EXISTS idx_productos_origen_fila ON productos (origen_fila)
  WHERE origen_fila IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_productos_revisar ON productos (revisar)
  WHERE revisar;
CREATE INDEX IF NOT EXISTS idx_productos_carrera_materia ON productos (carrera, materia);

ALTER TABLE precios_impresion ENABLE ROW LEVEL SECURITY;
ALTER TABLE anillos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acabados_tramos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acabados_fijos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_precios_impresion" ON precios_impresion;
CREATE POLICY "auth_all_precios_impresion" ON precios_impresion
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_anillos" ON anillos;
CREATE POLICY "auth_all_anillos" ON anillos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_acabados_tramos" ON acabados_tramos;
CREATE POLICY "auth_all_acabados_tramos" ON acabados_tramos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_acabados_fijos" ON acabados_fijos;
CREATE POLICY "auth_all_acabados_fijos" ON acabados_fijos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Datos de referencia de los CSV. DO NOTHING preserva cualquier cambio posterior
-- hecho por el mantenimiento.
INSERT INTO anillos (medida_mm, capacidad_hojas, precio, activo) VALUES
  (17, 160, 800, true),
  (23, 190, 2000, true),
  (33, 300, 2000, true),
  (40, 360, 2300, true),
  (50, 500, 6500, true),
  (9, NULL, NULL, false),
  (12, NULL, NULL, false),
  (14, NULL, NULL, false),
  (20, NULL, NULL, false),
  (25, NULL, NULL, false),
  (29, NULL, NULL, false),
  (36, NULL, NULL, false),
  (45, NULL, NULL, false)
ON CONFLICT (medida_mm) DO NOTHING;

INSERT INTO precios_impresion
  (tipo_papel, tamano, hojas_desde, hojas_hasta, precio_por_hoja)
VALUES
  ('comun', 'A4', 1, 5, 500), ('comun', 'A4', 6, 10, 300), ('comun', 'A4', 11, NULL, 150),
  ('comun', 'A3', 1, 5, 1000), ('comun', 'A3', 6, 10, 600), ('comun', 'A3', 11, NULL, 300),
  ('fotografico', 'A4', 1, 3, 2500), ('fotografico', 'A4', 4, 6, 1500), ('fotografico', 'A4', 7, NULL, 700),
  ('fotografico', 'A3', 1, 3, 5000), ('fotografico', 'A3', 4, 6, 3000), ('fotografico', 'A3', 7, NULL, 1400),
  ('chambril', 'A4', 1, 3, 1500), ('chambril', 'A4', 4, 6, 700), ('chambril', 'A4', 7, NULL, 500),
  ('chambril', 'A3', 1, 3, 3000), ('chambril', 'A3', 4, 6, 1400), ('chambril', 'A3', 7, NULL, 1000)
ON CONFLICT (tipo_papel, tamano, hojas_desde, vigente_desde) DO NOTHING;

INSERT INTO acabados_tramos (acabado, paginas_desde, paginas_hasta, precio) VALUES
  ('anillado', 1, 200, 5000),
  ('anillado', 201, 500, 8000),
  ('anillado', 501, NULL, 10000)
ON CONFLICT (acabado, paginas_desde) DO NOTHING;

INSERT INTO acabados_fijos (acabado, tamano, precio) VALUES
  ('encuadernado', 'A4', 9000)
ON CONFLICT (acabado, tamano) DO NOTHING;

-- Reemplaza el mecanismo anterior de modos de precio. Los precios pasan a las
-- cuatro tablas anteriores y las funciones que siguen.
DELETE FROM parametros_precio;

CREATE OR REPLACE FUNCTION hojas_de(p_paginas int)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  IF p_paginas < 1 THEN
    RAISE EXCEPTION 'Las páginas deben ser mayores que cero';
  END IF;
  RETURN ceil(p_paginas / 2.0)::int;
END;
$$;

CREATE OR REPLACE FUNCTION anillado_para(p_paginas int)
RETURNS TABLE (anillos int, medida_mm int, precio numeric)
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  v_hojas int;
  v_capacidad_maxima int;
  v_anillos int;
  v_hojas_por_anillo int;
BEGIN
  v_hojas := hojas_de(p_paginas);
  SELECT max(a.capacidad_hojas) INTO v_capacidad_maxima
  FROM anillos a
  WHERE a.activo AND a.capacidad_hojas IS NOT NULL AND a.precio IS NOT NULL;

  IF v_capacidad_maxima IS NULL THEN
    RAISE EXCEPTION 'No hay anillos activos con capacidad y precio configurados';
  END IF;

  v_anillos := ceil(v_hojas::numeric / v_capacidad_maxima)::int;
  v_hojas_por_anillo := ceil(v_hojas::numeric / v_anillos)::int;

  RETURN QUERY
  SELECT v_anillos, a.medida_mm, a.precio * v_anillos
  FROM anillos a
  WHERE a.activo
    AND a.capacidad_hojas >= v_hojas_por_anillo
    AND a.precio IS NOT NULL
  ORDER BY a.capacidad_hojas, a.medida_mm
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay una medida de anillo activa para % hojas por anillo', v_hojas_por_anillo;
  END IF;
END;
$$;

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
DECLARE
  v_precio_por_hoja numeric;
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
  -- Los importes del catálogo se muestran en centenas para evitar valores
  -- incómodos como $77.100; los casos exactos conservan su mismo valor.
  RETURN round((v_precio_por_hoja * p_hojas) / 100) * 100;
END;
$$;

CREATE OR REPLACE FUNCTION precio_anillado_particular(p_paginas int)
RETURNS numeric
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE v_precio numeric;
BEGIN
  IF p_paginas < 1 THEN
    RAISE EXCEPTION 'Las páginas deben ser mayores que cero';
  END IF;
  SELECT at.precio INTO v_precio
  FROM acabados_tramos at
  WHERE at.acabado = 'anillado'
    AND at.activo
    AND at.paginas_desde <= p_paginas
    AND (at.paginas_hasta IS NULL OR at.paginas_hasta >= p_paginas)
  ORDER BY at.paginas_desde DESC
  LIMIT 1;
  IF v_precio IS NULL THEN
    RAISE EXCEPTION 'No hay precio de anillado para % páginas', p_paginas;
  END IF;
  RETURN v_precio;
END;
$$;

CREATE OR REPLACE FUNCTION cotizar_trabajo(
  p_paginas int,
  p_tipo_papel text,
  p_tamano text,
  p_anillado boolean DEFAULT false,
  p_encuadernado boolean DEFAULT false,
  p_apaisado boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_hojas int;
  v_impresion numeric;
  v_anillos int := 0;
  v_medida int;
  v_anillado numeric := 0;
  v_encuadernado numeric := 0;
  v_total numeric;
BEGIN
  v_hojas := hojas_de(p_paginas);
  v_impresion := precio_impresion(p_tipo_papel, p_tamano, v_hojas);

  IF p_anillado THEN
    -- La medida física se informa según anillado_para; el cobro de trabajo
    -- particular sigue la tabla acabados_tramos.
    SELECT ap.anillos, ap.medida_mm INTO v_anillos, v_medida
    FROM anillado_para(p_paginas) ap;
    v_anillado := precio_anillado_particular(p_paginas);
  END IF;

  IF p_encuadernado THEN
    IF upper(p_tamano) <> 'A4' THEN
      RAISE EXCEPTION 'El encuadernado solo está disponible en A4';
    END IF;
    SELECT af.precio INTO v_encuadernado
    FROM acabados_fijos af
    WHERE af.acabado = 'encuadernado' AND af.tamano = 'A4' AND af.activo;
    IF v_encuadernado IS NULL THEN
      RAISE EXCEPTION 'No hay encuadernado A4 activo configurado';
    END IF;
  END IF;

  v_total := v_impresion + v_anillado + v_encuadernado;
  IF p_apaisado THEN v_total := v_total / 2; END IF;

  RETURN jsonb_build_object(
    'paginas', p_paginas,
    'hojas', v_hojas,
    'tipo_papel', lower(p_tipo_papel),
    'tamano', upper(p_tamano),
    'precio_impresion', v_impresion,
    'anillos', v_anillos,
    'medida_mm', v_medida,
    'precio_anillado', v_anillado,
    'precio_encuadernado', v_encuadernado,
    'apaisado', p_apaisado,
    'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION importar_catalogo_productos(p_filas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE v_procesadas int;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS staging_catalogo_productos (
    destino text, prioridad text, motivo text, accion_sugerida text, origen_fila text,
    codigo text, nombre_original text, nombre_final text, carrera text, materia text,
    paginas text, hojas_calc text, anillos_final text, anillo_mm_final text,
    precio_anillado_final text, precio_calculado text, dif_vs_planilla text,
    precio_venta text, precio_sin_anillado text, precio_apaisado text,
    precio_apaisado_sin_anillado text, stock text, flags text, notas_nombre text
  ) ON COMMIT DROP;
  TRUNCATE staging_catalogo_productos;

  INSERT INTO staging_catalogo_productos
  SELECT * FROM jsonb_to_recordset(p_filas) AS s(
    destino text, prioridad text, motivo text, accion_sugerida text, origen_fila text,
    codigo text, nombre_original text, nombre_final text, carrera text, materia text,
    paginas text, hojas_calc text, anillos_final text, anillo_mm_final text,
    precio_anillado_final text, precio_calculado text, dif_vs_planilla text,
    precio_venta text, precio_sin_anillado text, precio_apaisado text,
    precio_apaisado_sin_anillado text, stock text, flags text, notas_nombre text
  );

  INSERT INTO productos (
    nombre, tipo, es_servicio, codigo_barras, carrera, materia, categoria,
    paginas, precio, activo, origen_fila, anillo_mm, anillos_cant, revisar, revisar_motivo
  )
  SELECT
    trim(s.nombre_final),
    'encargo',
    lower(trim(s.destino)) = 'servicio',
    nullif(trim(s.codigo), ''),
    CASE WHEN lower(trim(s.carrera)) IN ('.', 'esc', 'facu', 'escuela') THEN NULL ELSE nullif(trim(s.carrera), '') END,
    CASE WHEN lower(trim(s.materia)) IN ('.', 'esc', 'facu', 'escuela') THEN NULL ELSE nullif(trim(s.materia), '') END,
    CASE WHEN lower(trim(s.destino)) = 'servicio' THEN 'Servicio' ELSE 'Apunte' END,
    NULLIF(trim(s.paginas), '')::numeric::int,
    CASE
      WHEN lower(trim(s.destino)) = 'servicio' THEN NULLIF(trim(s.precio_venta), '')::numeric
      ELSE NULLIF(trim(s.precio_sin_anillado), '')::numeric
    END,
    true,
    NULLIF(trim(s.origen_fila), '')::int,
    ap.medida_mm,
    ap.anillos,
    (
      nullif(trim(s.carrera), '') IS NULL OR nullif(trim(s.materia), '') IS NULL
      OR lower(trim(s.carrera)) IN ('.', 'esc', 'facu', 'escuela')
      OR lower(trim(s.materia)) IN ('.', 'esc', 'facu', 'escuela')
      OR trim(s.accion_sugerida) IN ('COMPLETAR en mantenimiento', 'DECIDIR si son productos distintos')
    ),
    CASE
      WHEN nullif(trim(s.carrera), '') IS NULL OR nullif(trim(s.materia), '') IS NULL
        OR lower(trim(s.carrera)) IN ('.', 'esc', 'facu', 'escuela')
        OR lower(trim(s.materia)) IN ('.', 'esc', 'facu', 'escuela')
      THEN 'Falta carrera o materia'
      WHEN trim(s.accion_sugerida) IN ('COMPLETAR en mantenimiento', 'DECIDIR si son productos distintos') THEN trim(s.motivo)
      ELSE NULL
    END
  FROM staging_catalogo_productos s
  LEFT JOIN LATERAL anillado_para(
    CASE WHEN lower(trim(s.destino)) = 'apunte'
      THEN NULLIF(trim(s.paginas), '')::numeric::int
      ELSE NULL
    END
  ) ap ON true
  WHERE lower(trim(s.destino)) IN ('apunte', 'servicio')
  ON CONFLICT (codigo_barras) WHERE codigo_barras IS NOT NULL AND codigo_barras <> '' DO UPDATE
  SET nombre = EXCLUDED.nombre,
      tipo = EXCLUDED.tipo,
      es_servicio = EXCLUDED.es_servicio,
      carrera = EXCLUDED.carrera,
      materia = EXCLUDED.materia,
      categoria = EXCLUDED.categoria,
      paginas = EXCLUDED.paginas,
      precio = EXCLUDED.precio,
      activo = EXCLUDED.activo,
      origen_fila = EXCLUDED.origen_fila,
      anillo_mm = EXCLUDED.anillo_mm,
      anillos_cant = EXCLUDED.anillos_cant,
      revisar = EXCLUDED.revisar,
      revisar_motivo = EXCLUDED.revisar_motivo;

  GET DIAGNOSTICS v_procesadas = ROW_COUNT;
  RETURN jsonb_build_object('procesadas', v_procesadas);
END;
$$;

NOTIFY pgrst, 'reload schema';
