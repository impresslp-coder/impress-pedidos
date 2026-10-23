# Reporte de migración de pedidos pendientes

Fecha de ejecución: 17/09/2026.

## Respaldo y ejecución

- Respaldo lógico previo: `backup_pre_pedidos_2026-09-17_0306.sql` (local, excluido de Git).
- La carga se ejecutó dos veces. La segunda corrida volvió a insertar los 278 ítems de los 131 pedidos sin crear clientes adicionales ni alterar los totales: la operación es idempotente.

## Verificación medida en PostgreSQL

| Control | Resultado |
| --- | ---: |
| Pedidos | 131 |
| Ítems | 278 |
| Cantidad total | 566 |
| Filas de origen de ítems | 566 |
| Pedidos en `entrega` | 126 |
| Pedidos en `encargos` | 5 |
| Total | $6.530.422 |
| Seña | $1.886.712 |
| Saldo calculado | $4.643.710 |
| Páginas | 82.234 |
| Pedidos sin cliente | 0 |
| Descuadres entre pedido e ítems | 0 |

Por sucursal de producción: 41 = 77 pedidos, 60 = 51, 44 = 3.

## Clientes creados

Los siete clientes fueron creados con `revisar = true`.

| Código | Cliente | Motivo de revisión |
| --- | --- | --- |
| `ANA050ERO` | Anabela Chavero | alta desde migración de pedidos |
| `NOV671CIO` | Novelino Fabricio | alta desde migración de pedidos |
| `ROM197LEN` | Romano Belen | teléfono coincide con otro cliente; verificar si es la misma persona |
| `SCE715ZOE` | Scenna Zoe | alta desde migración de pedidos |
| `AYE568CTA` | Ayelen Romina Azcta | teléfono coincide con otro cliente; verificar si es la misma persona |
| `DAM954ELE` | Damian Mele | alta desde migración de pedidos |
| `YAN369UIZ` | Yanina Beatriz Ruiz | alta desde migración de pedidos |

## Pedidos no migrados

| Pedido | Cliente | Motivo |
| --- | --- | --- |
| 3166 | Antonela Agostinelli | REPETIDO |
| 3393 | Betiana Hernandez | REPETIDO |
| 3475 | Veronica Lopez | REPETIDO |
| 3696 | Juliana Gonzalez | REPETIDO |
| 4249 | Jorge Marzano | CANCELADO |
| 4551 | Verónica Diez | YA ENTREGADO |

## Casos que requieren seguimiento

- Pedido `2441`: quedó marcado para revisión. La anotación contiene `PRIORIDAD ALTA`; no se subió la prioridad, porque debe confirmarla un supervisor.
- Pedido `4497`: conserva `ubicacion = RETIRO`. No se clasificó como ubicación física; requiere decisión operativa.
- Pedido `4248`: el nombre `Sergio Avalos` tenía dos fichas activas. Nicolás confirmó `SER642LOS`; la resolución quedó registrada en `staging.resoluciones_cliente_pedidos`.

## Migraciones aplicadas, en orden

1. `20260915_001_migracion_clientes.sql`
2. `20260917_002_items_pedido_migracion.sql`
3. `20260917030100_pedidos_tarjeta_base.sql`
4. `20260917030200_staging_pedidos.sql`
5. `20260917030300_reparar_transformacion_pedidos.sql`
6. `20260917030400_resolucion_clientes_duplicados.sql`

## Deuda técnica

- Las políticas RLS existentes siguen siendo permisivas (`authenticated` puede operar sobre las tablas). No se modificaron durante esta migración.
- `src/lib/supabase/database.types.ts` fue regenerado contra el esquema remoto.
- La pantalla de tarjeta/flujo de pedidos todavía debe adaptarse a los nuevos estados y a las reglas de producción, mensajes y tickets definidas en la especificación.
