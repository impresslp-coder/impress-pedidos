-- El plan actual de Vercel no permite cron horario. El control queda en
-- Supabase para que corra aunque nadie tenga abierta la aplicación.

CREATE OR REPLACE FUNCTION public.generar_recordatorios_produccion_vencida()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_insertados INTEGER := 0;
BEGIN
  WITH vencidos AS (
    SELECT
      p.id AS pedido_id,
      p.numero,
      p.sucursal_produccion,
      p.produccion_por,
      p.produccion_vence_en,
      p.produccion_vence_en <= NOW() - INTERVAL '24 hours' AS supera_48_horas
    FROM public.pedidos p
    WHERE p.estado = 'En producción'
      AND p.produccion_terminada_en IS NULL
      AND p.produccion_vence_en <= NOW()
  ), destinatarios AS (
    SELECT v.*, v.produccion_por AS usuario_id
    FROM vencidos v
    WHERE v.produccion_por IS NOT NULL
    UNION
    SELECT v.*, u.id AS usuario_id
    FROM vencidos v
    JOIN public.usuarios_sistema u
      ON u.activo = TRUE
     AND u.rol = 'admin'
     AND regexp_replace(coalesce(u.sucursal_default, ''), '\\D', '', 'g') = regexp_replace(coalesce(v.sucursal_produccion, ''), '\\D', '', 'g')
  ), candidatos AS (
    SELECT
      d.pedido_id,
      d.numero,
      d.sucursal_produccion,
      d.usuario_id,
      nivel.motivo,
      nivel.tipo,
      nivel.titulo,
      nivel.detalle
    FROM destinatarios d
    CROSS JOIN LATERAL (
      SELECT
        'produccion vencida'::TEXT AS motivo,
        'produccion_vencida_24h'::TEXT AS tipo,
        format('Producción vencida · Pedido #%s', d.numero) AS titulo,
        format('El pedido superó las 24 horas corridas de producción.%s', CASE WHEN nullif(btrim(d.sucursal_produccion), '') IS NULL THEN '' ELSE format(' Sucursal %s.', d.sucursal_produccion) END) AS detalle
      UNION ALL
      SELECT
        'produccion vencida 48h',
        'produccion_vencida_48h',
        format('Escalamiento de producción · Pedido #%s', d.numero),
        format('El pedido lleva más de 48 horas corridas vencido. Requiere aviso al encargado por WhatsApp.%s', CASE WHEN nullif(btrim(d.sucursal_produccion), '') IS NULL THEN '' ELSE format(' Sucursal %s.', d.sucursal_produccion) END)
      WHERE d.supera_48_horas
    ) nivel
  ), nuevos AS (
    INSERT INTO public.recordatorios_produccion (pedido_id, destinatario, motivo)
    SELECT c.pedido_id, c.usuario_id, c.motivo
    FROM candidatos c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.recordatorios_produccion r
      WHERE r.pedido_id = c.pedido_id
        AND r.destinatario = c.usuario_id
        AND r.motivo = c.motivo
        AND r.enviado_en >= NOW() - INTERVAL '24 hours'
    )
    RETURNING pedido_id, destinatario, motivo
  ), avisos AS (
    INSERT INTO public.notificaciones (usuario_id, pedido_id, tipo, titulo, detalle)
    SELECT c.usuario_id, c.pedido_id, c.tipo, c.titulo, c.detalle
    FROM nuevos n
    JOIN candidatos c
      ON c.pedido_id = n.pedido_id
     AND c.usuario_id = n.destinatario
     AND c.motivo = n.motivo
    RETURNING id
  )
  SELECT count(*) INTO v_insertados FROM avisos;

  RETURN v_insertados;
END;
$$;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'produccion-vencida';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'produccion-vencida',
    '0 * * * *',
    'SELECT public.generar_recordatorios_produccion_vencida();'
  );
END;
$$;

COMMENT ON FUNCTION public.generar_recordatorios_produccion_vencida() IS
  'Genera avisos internos por vencimiento de producción a las 24 h y escalamiento a las 48 h; se ejecuta cada hora desde pg_cron.';

NOTIFY pgrst, 'reload schema';
