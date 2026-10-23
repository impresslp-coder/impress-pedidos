# Migración Impress — Checkpoint 3: carga y reconciliación

Fecha de verificación: 18/09/2026.

Se ejecutó:

```powershell
node scripts/migracion/verificar-migracion.mjs
```

El script terminó correctamente y valida los CSV auditados contra Supabase sin escribir datos.

## Resultado

| Control | Origen / esperado | Medido en Supabase |
| --- | ---: | ---: |
| Clientes históricos | 3.506 | 3.506 |
| Códigos de cliente faltantes | 0 | 0 |
| Pedidos migrados | 131 | 131 |
| Ítems | 278 | 278 |
| Cantidad consolidada | 566 | 566 |
| Filas de origen de ítems | 566 | 566 |
| Total | $6.530.422 | $6.530.422 |
| Seña | $1.886.712 | $1.886.712 |
| Saldo calculado | $4.643.710 | $4.643.710 |
| Páginas | 82.234 | 82.234 |
| Pedidos sin cliente | 0 | 0 |
| Descuadres cabecera / ítems | 0 | 0 |

Los controles del CSV de clientes también coinciden: 3.485 con país `549`, 21 extranjeros, 130 sin teléfono, 576 con mail, 3 inactivos y 582 en revisión.

## Estados actuales

Los estados técnicos originales de la carga (`entrega` y `encargos`) fueron normalizados por migraciones operativas posteriores. Al momento de esta verificación, los 131 pedidos se encuentran así:

| Estado actual | Pedidos |
| --- | ---: |
| Listo para entregar | 126 |
| En producción | 2 |
| Encargo recibido | 3 |

Esto no altera cantidad, cliente, ítems, importes ni trazabilidad. El verificador muestra ambos datos para evitar que una evolución posterior del flujo se interprete como una falla de migración.

## Casos pendientes de decisión operativa

- Pedido 2441: conserva revisión por la frase `PRIORIDAD ALTA`; debe definirlo un supervisor.
- Pedido 4497: la ubicación `RETIRO` sigue sin clasificación operativa.
- Los siete clientes agregados desde pedidos permanecen en la cola de revisión; no se fusionaron automáticamente.

## Deuda técnica registrada

RLS sigue permisivo para usuarios autenticados, tal como indicaba el alcance. No se modificó durante la migración.
