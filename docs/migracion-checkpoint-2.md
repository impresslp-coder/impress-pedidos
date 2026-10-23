# Migración Impress — Checkpoint 2: auditoría de pedidos pendientes

Fecha de cierre documental: 18/09/2026.

## Fuente auditada que se preservó

La carga se hizo desde los CSV auditados de `Claude outputs/`, sin escribir en Google Sheets:

| Archivo | Filas | Uso |
| --- | ---: | --- |
| `pedidos_pendientes.csv` | 131 | Cabeceras pendientes para migrar |
| `items_pedido.csv` | 278 | Ítems consolidados; representan 566 filas de origen |
| `clientes_nuevos_desde_pedidos.csv` | 7 | Altas que faltaban en CLIENTES |
| `pedidos_excluidos.csv` | 6 | Cancelados o repetidos, fuera de la carga |

Todos los importes de los CSV auditados convierten a número. La suma de cabeceras es $6.530.422; la seña suma $1.886.712 y el saldo calculado es $4.643.710.

## Estados y pendientes

En el conjunto que se migró, los estados de planilla fueron:

| Estado de planilla | Pedidos |
| --- | ---: |
| `Listo para entregar` | 126 |
| `Encargo recibido` | 5 |

La totalidad de las 131 cabeceras corresponde a pedidos no entregados incluidos en la carga. Los seis excluidos fueron cuatro repetidos, un cancelado y uno ya entregado; sus números y motivos están en `pedidos_excluidos.csv` y en el reporte de carga.

## Vinculación con clientes

- Pedidos sin cliente después de la carga: **0**.
- Se crearon 7 clientes y quedaron con `revisar = true`.
- El pedido 4248 tenía dos fichas posibles para Sergio Avalos; se registró la resolución explícita `SER642LOS` en `staging.resoluciones_cliente_pedidos`.

## Numeración elegida

Se conservaron los números de pedido de origen como `pedidos.numero` y también como `numero_origen`. Los 131 números auditados son únicos y no chocan con los números de prueba previos de la aplicación (`0000001` a `0000040`). El contador de la app se mantuvo en 40: los pedidos posteriores creados por la aplicación continúan desde ese contador y no colisionan con los números históricos migrados.

## Auditoría posterior de las hojas vivas

El 18/09 se releyó la planilla en modo solo lectura. La fuente disponible hoy no es una foto congelada del conjunto que originó estos CSV: `BaseDeDatos` tiene 9.851 filas de grilla y `BaseTerciarizado` solo conserva 15 valores de estado, mientras que las tres pestañas legacy no tienen una columna `Estado del pedido` literal. Por eso no se mezclaron sus 911 filas no entregadas actuales con los 131 pedidos de esta carga.

El inventario de pestañas, encabezados, estados actuales y límites de comparación quedó en `docs/auditoria-google-sheets-2026-09-18.md`. Este checkpoint sigue probando el conjunto efectivamente migrado, sus importes y sus exclusiones, sin inventar métricas retroactivas para una foto histórica que ya cambió.
