# Migración Impress — Checkpoint 1

Fecha: 2026-09-15

## Resultado

No se insertó, modificó ni borró ningún dato.

La auditoría contra Supabase no pudo iniciarse porque el endpoint configurado en `.env.local` no resuelve por DNS:

- Host: `ynvfezzfqsxjbkanzfoj.supabase.co`
- Prueba TCP local a puerto 443: fallida por resolución de nombre.
- Consulta DNS del FQDN absoluto contra `1.1.1.1`: `Non-existent domain`.

Esto apunta a un project ref inválido, un proyecto eliminado o una URL desactualizada; no es un fallo de credenciales. Un proyecto pausado normalmente conserva su DNS y responde indicando que está pausado. No se expuso ninguna clave durante las pruebas.

## Estado solicitado de la base

| Control | Resultado |
| --- | --- |
| `clientes` | No disponible: endpoint inaccesible |
| `pedidos` | No disponible: endpoint inaccesible |
| `items_pedido` | No disponible: endpoint inaccesible |
| Muestra de 20 clientes | No disponible: endpoint inaccesible |
| `counters` | No disponible: endpoint inaccesible |
| Clientes/pedidos creados manualmente | No determinable hasta recuperar la conexión |
| Esquema real vs. archivos locales | No verificable hasta recuperar la conexión |

## Controles locales del CSV auditado

El archivo `Claude outputs/clientes_para_app.csv` es UTF-8 válido y reproduce todos los controles que pueden comprobarse sin acceder a la base.

| Métrica | Esperado | Obtenido |
| --- | ---: | ---: |
| Filas | 3506 | 3506 |
| `cod_pais = '549'` | 3485 | 3485 |
| Extranjeros | 21 | 21 |
| Sin teléfono | 130 | 130 |
| Con mail | 576 | 576 |
| `activo = false` | 3 | 3 |
| `revisar = true` | 582 | 582 |

## Hallazgo local de esquema

`supabase-schema.sql` y `migrations/setup-completo.sql` describen el esquema base y extensiones operativas. `src/lib/supabase/database.types.ts` no está completamente actualizado respecto de esas migraciones: para `pedidos`, por ejemplo, no declara las columnas base `medio_contacto`, `sucursal`, `carpeta_url` y `url_comprobante`, ni las extensiones posteriores de producción. La comparación con el esquema real queda pendiente de recuperar la conexión.

## Preparado para reanudar

Se agregó `scripts/migracion/fase0-auditar.mjs`, una auditoría de solo lectura que:

1. cuenta `clientes`, `pedidos` e `items_pedido`;
2. obtiene la muestra de 20 clientes y los contadores;
3. consulta el esquema publicado por PostgREST y contrasta sus columnas con las declaradas localmente;
4. nunca imprime valores de `.env.local`.

Al corregirse el endpoint, se debe ejecutar `node scripts/migracion/fase0-auditar.mjs` y completar este checkpoint antes de cualquier inserción.

## Actualización: reanudación iniciada

El proyecto correcto fue identificado como `web-impress` (ref `ynvfezzfqsxjbkanzfoj`) y se inició su reanudación desde el panel de Supabase con autorización del propietario. Al último control el panel mostraba **Coming up...**. La API ya responde durante el arranque, pero PostgREST todavía informa `PGRST205` para `public.clientes` porque su caché de esquema no terminó de inicializarse. No se realizó ninguna carga mientras el proyecto se recupera.

## Resultado final del checkpoint 1

La reanudación terminó y la API está operativa. Los apartados iniciales de indisponibilidad quedan como registro cronológico y están superados por los resultados siguientes.

| Control | Resultado |
| --- | ---: |
| `clientes` | 5 |
| `pedidos` | 40 |
| `items_pedido` | 43 |
| Counter `pedidos` | 40 |
| Counter `presupuestos` | 0 |
| Counter `terciarizados` | 5 |
| Counter `ventas` | 5 |

Los cinco clientes existentes fueron creados entre el 02/05/2026 y el 09/09/2026. Los 40 pedidos existentes van de `0000001` a `0000040`, creados entre esas mismas fechas. No tienen trazabilidad de migración; se tratan como registros preexistentes de la app. Entre los clientes hay dos registros de prueba del cotizador web y dos variantes del cliente Nicolás Varvasino. No se modificó ni fusionó ninguno.

El esquema real contiene las tablas y todas las columnas requeridas por esta migración. `pedidos` posee además 15 columnas operativas que no aparecen en `supabase-schema.sql` ni en `migrations/setup-completo.sql` (fechas, segundo pago, operadores y URLs de tickets); están fuera del alcance y no se tocarán. `src/lib/supabase/database.types.ts` también está desactualizado para `pedidos`, ya que no incluye algunas columnas base y extensiones operativas.

### Decisión requerida

Antes de insertar los 3.506 clientes del CSV, se debe decidir cómo tratar los cinco clientes existentes: conservarlos cuando su `codigo` no esté en el CSV y actualizar desde el CSV si coincide, o seguir otra regla explícita. No se cargó ningún cliente mientras esta decisión está pendiente.

## Actualización: limpieza de pruebas y carga de clientes

Con autorización posterior se eliminaron los 5 clientes y 40 pedidos de prueba, junto con sus 43 ítems, 12 metadatos de archivos de pedido y 9 eventos de impresión asociados. Los archivos físicos de Google Drive no se eliminaron y, si existían, permanecen recuperables allí. El contador `pedidos` se mantuvo en 40 porque no se autorizó modificarlo.

Después se aplicó `supabase/migrations/20260915_001_migracion_clientes.sql` y se ejecutó `scripts/migracion/cargar-clientes.mjs --apply`. La carga fue de 3.506 clientes en staging y 3.506 upserts en `clientes`.

| Control posterior a la carga | Resultado |
| --- | ---: |
| Clientes | 3506 |
| `cod_pais = '549'` | 3485 |
| Sin teléfono | 130 |
| Con mail | 576 |
| Inactivos | 3 |
| `revisar = true` | 582 |
| Vista `clientes_a_revisar` | 582 |
| Filas en staging | 3506 |

## Bloqueo de fase 2

La cuenta de servicio de Google configurada en `.env.local` fue rechazada por Google OAuth con `invalid_grant: account not found`. Por la regla de solo lectura mediante Google Sheets API, no se leyó la planilla por otro medio y no se auditó ni migró ningún pedido. Para continuar se necesita una cuenta de servicio activa, una clave privada válida y permiso de lector sobre la planilla `1GMZq9XQCPJw_C98duJ8bU_IitRHaEgVXSbHyiBsVJ0U`.
