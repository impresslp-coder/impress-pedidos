# Migración histórica de Impress

Este documento describe los artefactos de la migración de clientes y pedidos pendientes realizada en septiembre de 2026.

## Estado actual

La carga histórica ya fue aplicada y verificada. No se debe volver a ejecutar una carga sobre producción para "probar" nada: usar el verificador de solo lectura.

```powershell
node scripts/migracion/verificar-migracion.mjs
```

El comando devuelve código distinto de cero si hay una diferencia en clientes históricos, códigos de origen, pedidos, ítems, cantidades, páginas, importes, señas, saldos o pedidos sin cliente. No imprime credenciales.

## Artefactos y orden histórico de ejecución

1. `supabase/migrations/20260915_001_migracion_clientes.sql`
2. `scripts/migracion/cargar-clientes.mjs --apply`
3. `supabase/migrations/20260917_002_items_pedido_migracion.sql`
4. `supabase/migrations/20260917030100_pedidos_tarjeta_base.sql`
5. `supabase/migrations/20260917030200_staging_pedidos.sql`
6. `supabase/migrations/20260917030300_reparar_transformacion_pedidos.sql`
7. `supabase/migrations/20260917030400_resolucion_clientes_duplicados.sql`
8. `scripts/migracion/cargar-pedidos.mjs --apply`
9. `scripts/migracion/verificar-migracion.mjs`

Los scripts de carga usan `.env.local` y la clave de servicio solo del lado de Node. Nunca deben ejecutarse desde el navegador ni versionarse las credenciales.

## Reversión

La reversión de una carga histórica debe hacerse únicamente desde un respaldo lógico anterior a la carga, nunca con borrados masivos a mano. El respaldo usado antes de pedidos fue `backup_pre_pedidos_2026-09-17_0306.sql`, local y excluido de Git.

Antes de cualquier restauración hay que:

1. Confirmar la ventana de datos que se desea revertir.
2. Realizar un respaldo nuevo del estado actual.
3. Restaurar en una base de prueba y ejecutar el verificador antes de tocar producción.
4. Obtener aprobación explícita para cualquier operación destructiva.

## Informes

- `docs/migracion-checkpoint-1.md`
- `docs/migracion-checkpoint-2.md`
- `docs/migracion-checkpoint-3.md`
- `docs/reporte-migracion-pedidos-2026-09-17.md`
- `docs/auditoria-google-sheets-2026-09-18.md` — inventario read-only de las fuentes vivas, posterior a la carga.
