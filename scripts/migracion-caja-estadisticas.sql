create extension if not exists "uuid-ossp";

create table if not exists caja_jornadas (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null,
  usuario_id uuid references usuarios_sistema(id) on delete set null,
  usuario_nombre text,
  billetes jsonb not null default '{}'::jsonb,
  gastos jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table caja_jornadas add column if not exists gastos jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'caja_jornadas_tipo_check'
  ) then
    alter table caja_jornadas drop constraint caja_jornadas_tipo_check;
  end if;
end $$;

alter table caja_jornadas
  add constraint caja_jornadas_tipo_check
  check (tipo in ('inicio', 'cierre', 'retiro', 'gasto'));

create index if not exists caja_jornadas_created_at_idx on caja_jornadas(created_at desc);
create index if not exists caja_jornadas_tipo_idx on caja_jornadas(tipo);
