-- ImpressOffice: una cuenta de Auth no alcanza para acceder a los datos.
-- Este proyecto usa Auth para empleados; el alta pública nunca debe habilitar un perfil.

ALTER TABLE public.usuarios_sistema ALTER COLUMN activo SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usuarios_sistema (id, email, nombre, rol, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'nombre', ''), split_part(NEW.email, '@', 1)),
    'operador',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- La toma de producción es una acción de empleados, nunca una RPC anónima.
ALTER FUNCTION public.tomar_pedido_en_produccion(UUID, UUID) SET search_path = '';
REVOKE ALL ON FUNCTION public.tomar_pedido_en_produccion(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tomar_pedido_en_produccion(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.impress_staff_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_sistema AS perfil
    WHERE perfil.id = (SELECT auth.uid()) AND perfil.activo IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.impress_staff_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.impress_staff_active() TO authenticated;

-- Una política RESTRICTIVE se combina con las políticas permisivas existentes.
-- Las tablas antiguas sin RLS se cierran y solo admiten empleados activos.
DO $$
DECLARE
  tabla record;
BEGIN
  FOR tabla IN
    SELECT c.relname, c.relrowsecurity
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    IF tabla.relrowsecurity THEN
      EXECUTE format('DROP POLICY IF EXISTS impress_active_staff_only ON public.%I', tabla.relname);
      EXECUTE format(
        'CREATE POLICY impress_active_staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.impress_staff_active()) WITH CHECK (public.impress_staff_active())',
        tabla.relname
      );
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla.relname);
      EXECUTE format('DROP POLICY IF EXISTS impress_active_staff_only ON public.%I', tabla.relname);
      EXECUTE format(
        'CREATE POLICY impress_active_staff_only ON public.%I FOR ALL TO authenticated USING (public.impress_staff_active()) WITH CHECK (public.impress_staff_active())',
        tabla.relname
      );
    END IF;
  END LOOP;
END;
$$;

-- El bucket de pedidos es privado: una sesión de Auth sin perfil activo
-- tampoco puede aprovechar políticas permisivas de Storage.
DROP POLICY IF EXISTS impress_active_staff_only ON storage.objects;
CREATE POLICY impress_active_staff_only ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.impress_staff_active())
  WITH CHECK (public.impress_staff_active());

-- Las vistas tradicionales corren con permisos del creador y pueden evitar
-- RLS. Esta vista contiene nombres, teléfonos y emails de clientes.
ALTER VIEW public.clientes_a_revisar SET (security_invoker = true);
REVOKE ALL ON public.clientes_a_revisar FROM PUBLIC, anon;
GRANT SELECT ON public.clientes_a_revisar TO authenticated;

-- Los cambios de rol y habilitación pasan solamente por la API admin con service_role.
REVOKE INSERT, UPDATE, DELETE ON public.usuarios_sistema FROM PUBLIC, anon, authenticated;

-- Las tareas de importación y el cron son SECURITY DEFINER. Sus GRANT a
-- service_role no revocaban el EXECUTE que PostgreSQL concede a PUBLIC.
DO $$
DECLARE
  funcion record;
BEGIN
  FOR funcion IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS argumentos
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'migrar_clientes_desde_staging',
        'reemplazar_staging_pedidos',
        'validar_staging_pedidos',
        'migrar_pedidos_desde_staging',
        'verificar_migracion_pedidos',
        'resolver_cliente_id_migracion',
        'generar_recordatorios_produccion_vencida'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', funcion.proname, funcion.argumentos);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', funcion.proname, funcion.argumentos);
  END LOOP;
END;
$$;
