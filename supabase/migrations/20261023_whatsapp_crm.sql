-- CRM de WhatsApp para IMPRESS.
-- Ejecutar una sola vez desde el SQL Editor de Supabase.

create table if not exists public.whatsapp_conversaciones (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  nombre_contacto text,
  ultimo_mensaje text,
  ultimo_mensaje_en timestamptz,
  ultimo_mensaje_tipo text check (ultimo_mensaje_tipo in ('entrante', 'saliente')),
  no_leidos integer not null default 0 check (no_leidos >= 0),
  estado text not null default 'abierta' check (estado in ('abierta', 'archivada')),
  asignado_a uuid references public.usuarios_sistema(id) on delete set null,
  etiquetas text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.whatsapp_conversaciones(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  tipo text not null check (tipo in ('entrante', 'saliente')),
  tipo_contenido text not null default 'texto',
  contenido text not null,
  estado text not null default 'recibido'
    check (estado in ('pendiente', 'recibido', 'enviado', 'entregado', 'leido', 'error')),
  proveedor_id text unique,
  error_mensaje text,
  metadata jsonb not null default '{}'::jsonb,
  enviado_en timestamptz,
  recibido_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists whatsapp_conversaciones_ultimo_idx
  on public.whatsapp_conversaciones (ultimo_mensaje_en desc nulls last);
create index if not exists whatsapp_conversaciones_cliente_idx
  on public.whatsapp_conversaciones (cliente_id);
create index if not exists whatsapp_mensajes_conversacion_idx
  on public.whatsapp_mensajes (conversacion_id, creado_en desc);
create index if not exists whatsapp_mensajes_proveedor_idx
  on public.whatsapp_mensajes (proveedor_id) where proveedor_id is not null;

create or replace function public.actualizar_resumen_conversacion_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_conversaciones
  set ultimo_mensaje = new.contenido,
      ultimo_mensaje_en = new.creado_en,
      ultimo_mensaje_tipo = new.tipo,
      no_leidos = case when new.tipo = 'entrante' then no_leidos + 1 else no_leidos end,
      estado = 'abierta',
      actualizado_en = now()
  where id = new.conversacion_id;
  return new;
end;
$$;

drop trigger if exists whatsapp_mensaje_actualiza_conversacion on public.whatsapp_mensajes;
create trigger whatsapp_mensaje_actualiza_conversacion
after insert on public.whatsapp_mensajes
for each row execute function public.actualizar_resumen_conversacion_whatsapp();

alter table public.whatsapp_conversaciones enable row level security;
alter table public.whatsapp_mensajes enable row level security;

-- El CRM accede únicamente desde Server Components, Server Actions y el webhook
-- mediante service_role. No se crean políticas para el cliente del navegador.
