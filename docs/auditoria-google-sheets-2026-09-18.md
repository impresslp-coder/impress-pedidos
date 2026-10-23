# Auditoría de Google Sheets — estado actual de las fuentes de pedidos

Fecha de lectura: 18/09/2026. La lectura se hizo con el alcance `spreadsheets.readonly`; no se escribió en la planilla ni en Supabase.

Planilla: `Base de datos impress V2` (`1GMZq9XQCPJw_C98duJ8bU_IitRHaEgVXSbHyiBsVJ0U`).

## Resultado relevante

La planilla disponible hoy no es una copia congelada de las cinco fuentes que originaron los CSV de la migración. Sus tamaños y algunas pestañas difieren del relevamiento inicial. Por eso no es válido recalcular hoy la Fase 2 como si fuera la foto histórica que se cargó el 17/09: hacerlo mezclaría pedidos posteriores e historial ya entregado.

Los CSV auditados en `Claude outputs/` siguen siendo el artefacto de la carga aplicada: 131 cabeceras, 278 ítems que representan 566 filas de origen y seis pedidos excluidos. La reconciliación contra Supabase se conserva en `migracion-checkpoint-3.md`.

## Inventario de fuentes candidatas

| Hoja | gid | Grilla | Estructura observada | Estado explícito | Resultado actual |
| --- | ---: | ---: | --- | --- | --- |
| `BaseDeDatos` | 617738668 | 9.851 × 51 | 49 encabezados; incluye `Numero de pedido`, `TOTAL` y `Estado del pedido` | Sí, columna S | 8.949 `Entregado`, 895 `Listo para entregar`, 6 `Encargo recibido`; 901 no entregados según esta columna. |
| `BaseTerciarizado` | 934861547 | 993 × 51 | 21 encabezados; incluye `Numero de pedido`, `Precio ` y `Estado del pedido` | Sí, columna K | 5 `Entregado`, 3 `Listo para entregar`, 7 `Encargo recibido`; 10 no entregados. Solo hay 15 valores no vacíos en la columna de estado. |
| `Base de datos` | 0 | 12.297 × 27 | 27 encabezados; tiene `Rechazado` y `Quien lo entrego`, pero no `Estado del pedido` | No | No se puede clasificar pendiente/entregado de forma fiable sin acordar una regla de negocio. |
| `Copia de Base de datos` | 1462205737 | 12.297 × 28 | Misma estructura funcional que `Base de datos`, con una columna vacía adicional | No | Es una candidata a copia, pero no se afirma duplicación fila a fila sin ejecutar una comparación completa sobre una foto inmutable. |
| `Diferencias de carga` | 1455369289 | 1.000 × 13 | 13 encabezados; recorte de campos legacy | No | No contiene una columna de estado que permita aplicar la definición de pendiente. |

La pestaña indicada antes como principal (`gid=660805100`, `Hoja 14`) contiene agregados como `Fecha - Año-Mes`, `SUM de Cantidad de hojas` y `CAJAS`; no se usó como fuente cruda de pedidos.

## Estados observados

Solo dos fuentes actuales exponen literalmente `Estado del pedido`. Sus valores distintos fueron:

| Hoja | Entregado | Listo para entregar | Encargo recibido | Otros | No entregados |
| --- | ---: | ---: | ---: | ---: | ---: |
| `BaseDeDatos` | 8.949 | 895 | 6 | 0 | 901 |
| `BaseTerciarizado` | 5 | 3 | 7 | 0 | 10 |

El total combinado de esas dos pestañas es 911 filas no entregadas, pero **no representa una carga adicional ni una comparación con los 131 pedidos migrados**: puede incluir datos posteriores, registros compartidos entre pestañas y órdenes con formatos distintos.

## Límites que evitan inventar datos

- Las tres fuentes legacy no tienen una columna `Estado del pedido`. Inferir entrega desde `Rechazado`, `Quien lo entrego` o un campo vacío cambiaría la definición de pendiente sin autorización.
- La cantidad de filas de las hojas actuales no coincide con los conteos parciales del relevamiento histórico. Esto impide usar sus totales presentes para afirmar cuántas filas había en la foto que dio origen a los CSV.
- No se recalcularon clientes no vinculados, importes no convertibles ni duplicados entre todas las pestañas porque requeriría una regla de unión y una fecha de corte que no están presentes en la planilla actual. Los controles de esos datos se hicieron sobre los CSV aprobados antes de la carga.

## Reproducibilidad

Para repetir solo el inventario y los conteos de estado actuales:

```powershell
node scripts/migracion/auditar-pedidos-google-sheets.mjs
```

El script solo lee metadatos, encabezados y las columnas de estado de las dos pestañas que las poseen. No imprime credenciales y no realiza operaciones de escritura.
