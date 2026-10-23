-- Migración de clientes históricos desde staging.
-- Es aditiva e idempotente: no elimina ni altera columnas existentes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_origen  TEXT,
  ADD COLUMN IF NOT EXISTS origen_fila    INT,
  ADD COLUMN IF NOT EXISTS revisar        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revisar_motivo TEXT,
  ADD COLUMN IF NOT EXISTS grupos_dup     TEXT[],
  ADD COLUMN IF NOT EXISTS duplicado_de   UUID REFERENCES public.clientes(id);

CREATE INDEX IF NOT EXISTS idx_clientes_revisar
  ON public.clientes (revisar) WHERE revisar;

CREATE INDEX IF NOT EXISTS idx_clientes_duplicado_de
  ON public.clientes (duplicado_de) WHERE duplicado_de IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.staging_clientes_migracion (
  codigo       TEXT,
  nombre       TEXT,
  cod_pais     TEXT,
  telefono     TEXT,
  mail         TEXT,
  activo       TEXT,
  codigo_origen TEXT,
  origen_fila  TEXT NOT NULL,
  revisar      TEXT,
  revisar_motivo TEXT,
  grupos_dup   TEXT,
  origen_hoja  TEXT NOT NULL,
  origen_gid   TEXT NOT NULL,
  cargado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (origen_hoja, origen_gid, origen_fila)
);

ALTER TABLE public.staging_clientes_migracion ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.migrar_clientes_desde_staging(
  p_origen_hoja TEXT,
  p_origen_gid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upsertadas INT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.staging_clientes_migracion
    WHERE origen_hoja = p_origen_hoja
      AND origen_gid = p_origen_gid
      AND (
        NULLIF(BTRIM(codigo), '') IS NULL
        OR NULLIF(BTRIM(nombre), '') IS NULL
        OR NULLIF(BTRIM(origen_fila), '') IS NULL
        OR LOWER(COALESCE(BTRIM(activo), '')) NOT IN ('true', 'false')
        OR LOWER(COALESCE(BTRIM(revisar), '')) NOT IN ('true', 'false')
      )
  ) THEN
    RAISE EXCEPTION 'Staging de clientes contiene campos obligatorios o booleanos inválidos';
  END IF;

  INSERT INTO public.clientes (
    codigo, nombre, cod_pais, telefono, mail, activo,
    codigo_origen, origen_fila, revisar, revisar_motivo, grupos_dup
  )
  SELECT
    BTRIM(codigo),
    BTRIM(nombre),
    NULLIF(BTRIM(cod_pais), ''),
    NULLIF(BTRIM(telefono), ''),
    NULLIF(BTRIM(mail), ''),
    LOWER(BTRIM(activo))::BOOLEAN,
    NULLIF(BTRIM(codigo_origen), ''),
    BTRIM(origen_fila)::INT,
    LOWER(BTRIM(revisar))::BOOLEAN,
    NULLIF(BTRIM(revisar_motivo), ''),
    STRING_TO_ARRAY(NULLIF(BTRIM(grupos_dup), ''), '|')
  FROM public.staging_clientes_migracion
  WHERE origen_hoja = p_origen_hoja
    AND origen_gid = p_origen_gid
  ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    cod_pais = EXCLUDED.cod_pais,
    telefono = EXCLUDED.telefono,
    mail = EXCLUDED.mail,
    activo = EXCLUDED.activo,
    codigo_origen = EXCLUDED.codigo_origen,
    origen_fila = EXCLUDED.origen_fila,
    revisar = EXCLUDED.revisar,
    revisar_motivo = EXCLUDED.revisar_motivo,
    grupos_dup = EXCLUDED.grupos_dup;

  GET DIAGNOSTICS v_upsertadas = ROW_COUNT;
  RETURN JSONB_BUILD_OBJECT('upsertadas', v_upsertadas);
END;
$$;

CREATE OR REPLACE VIEW public.clientes_a_revisar AS
SELECT id, codigo, nombre, cod_pais, telefono, mail,
       revisar_motivo, grupos_dup, origen_fila
FROM public.clientes
WHERE revisar AND duplicado_de IS NULL
ORDER BY grupos_dup NULLS LAST, nombre;

NOTIFY pgrst, 'reload schema';
