# 🧠 Memoria a largo plazo — impress-pedidos

> Conocimiento durable del proyecto: decisiones, convenciones y lecciones aprendidas.
> Esto **no** es un changelog ni un estado actual (para eso está `CLAUDE.md` / `AGENTS.md`).
> Actualizar solo cuando se aprende algo que va a seguir siendo cierto dentro de varios meses.

---

## Convenciones del repo

- **`CLAUDE.md` y `AGENTS.md` son el mismo documento duplicado** (uno lo lee Claude Code, el otro Codex).
  Si se actualiza el estado del proyecto en uno, replicar el cambio en el otro.
- **Sin acceso directo a Postgres/psql.** Solo hay claves de Supabase REST (`SUPABASE_SERVICE_ROLE_KEY`) en `.env.local`.
  Cualquier `ALTER TABLE` / `CREATE TABLE` nuevo requiere que el usuario lo corra a mano en el SQL Editor de Supabase.
  Guardar los scripts en `/migrations` (histórico) o `/supabase/migrations` (el que parece estar usando el socio).
- **`parametros_precio` y `sucursales` no tienen FK entrantes** desde ninguna otra tabla (confirmado por grep sobre
  `supabase-schema.sql` y todo `/migrations`). Los pedidos guardan sucursal/producto como texto, no por id.
  Esto significa que un DELETE físico sobre esas dos tablas es seguro — no rompe integridad referencial.
- **`parametros_precio.categoria`**: `'hojas'` = parámetro de impresión real (aplica Simple/Doble faz vía `divisor`).
  Cualquier otro valor (ej. `'servicio'`) = precio fijo, no tiene sentido mostrarle el selector de faz.
  La columna ya existía en la base real antes de que el frontend la usara (ver incidente del stash abajo).
- **WhatsApp de IMPRESS tiene integración propia.** La app publicada es `CRM Impress`, el negocio verificado es
  `Impress Group` y el número real es `+54 9 221 585-4997`. Las credenciales existentes viven en el proyecto
  Vercel `impress-crm`; no se deben usar credenciales de Amedex ni las de la cuenta de prueba. El webhook nuevo vive en
  `/api/whatsapp/webhook`, exige firma HMAC en producción y persiste en `whatsapp_conversaciones` /
  `whatsapp_mensajes`. Las variables requeridas están documentadas en `docs/WHATSAPP_CRM.md`.

## Incidente: trabajo perdido en un `git stash` (2026-07)

Se encontró un `git stash` de hace ~2 meses (`WIP on main: c7cd03f...`) que el socio dejó sin aplicar antes de
bajarse cambios del remoto (`git pull`). El stash tenía ~27 archivos con features que nunca llegaron a `main`:
botón "Impresiones personales" en el form de pedidos, integración de Mercado Pago para matchear transferencias,
y un calculador de costo de anillado por rango de hojas (`anillado_rangos`).

**Lección:** si alguna vez aparece una funcionalidad que "existía antes" y no está en el código actual, buscar en
`git stash list` y `git log --all -S"<texto>"` antes de asumir que se perdió para siempre. El historial de commits
en este repo es corto (pocos commits grandes), así que gran parte del trabajo intermedio vive en stashes o en la
base de datos misma (columnas/tablas ya migradas sin el frontend correspondiente).

**Práctica a seguir:** nunca dejar un `git stash` "para después" sin popearlo el mismo día, o convertirlo en un
commit/branch (`git stash branch nombre-temporal`) para que no quede huérfano si el branch avanza.

## Base de datos vs. código: pueden ir desincronizados

La tabla `anillado_rangos` y la columna `parametros_precio.categoria` ya existían en la base de Supabase real
(migración `supabase/migrations/add_anillado_rangos.sql`, ya corrida) meses antes de que el frontend las usara.
Antes de asumir "esto no está implementado", conviene revisar el estado real de la base (no solo el código) —
la migración pudo haberse corrido de forma independiente del merge del frontend correspondiente.

## Pendiente de decisión (no resuelto, no es bug)

El resto del stash rescatado (Mercado Pago + calculador de anillado por rango) **no se reincorporó** — solo se
recuperó el botón de "Impresiones personales" porque fue lo único pedido explícitamente. Ver
`MEMORIA_CORTO_PLAZO.md` para el detalle de qué falta decidir al respecto.
