# WhatsApp CRM de IMPRESS

El módulo `/whatsapp` replica el núcleo operativo del CRM de Amedex, adaptado a clientes y pedidos de IMPRESS:

- bandeja de conversaciones y búsqueda;
- mensajes entrantes y salientes;
- estados `enviado`, `entregado`, `leído` y `error` informados por Meta;
- contador de mensajes sin leer;
- vínculo automático con `clientes` por los últimos 8 dígitos del teléfono;
- pedidos recientes del cliente;
- control visual de la ventana de atención de 24 horas;
- validación de la firma `X-Hub-Signature-256` del webhook.

## 1. Base de datos

Ejecutar en el SQL Editor del Supabase de IMPRESS:

```text
supabase/migrations/20261023_whatsapp_crm.sql
```

La migración crea `whatsapp_conversaciones`, `whatsapp_mensajes`, índices y el trigger que mantiene el resumen y los no leídos. RLS queda habilitado y el navegador no accede directamente a estas tablas.

## 2. Variables de entorno

Agregar en `.env.local` para desarrollo y en Vercel para Production/Preview según corresponda. Los secretos deben cargarse como **Secret**, nunca con prefijo `NEXT_PUBLIC_`.

```dotenv
WHATSAPP_PROVIDER=meta_cloud
META_GRAPH_VERSION=v26.0
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
WHATSAPP_WEBHOOK_FIRMA=exigir
WHATSAPP_DEFAULT_COUNTRY_CODE=549
```

Qué representa cada valor:

- `META_WHATSAPP_PHONE_NUMBER_ID`: ID del número de WhatsApp de IMPRESS en Meta, no el teléfono visible.
- `META_WHATSAPP_TOKEN`: token permanente de un System User con acceso al activo de WhatsApp de IMPRESS.
- `META_WEBHOOK_VERIFY_TOKEN`: texto secreto elegido por IMPRESS; debe ser idéntico en Meta y Vercel.
- `META_APP_SECRET`: App Secret de la aplicación de Meta; valida que cada POST provenga de Meta.
- `META_GRAPH_VERSION`: versión configurable de Graph API. Al momento de la migración, la suscripción de IMPRESS usa `v26.0`.
- `WHATSAPP_WEBHOOK_FIRMA`: usar `exigir` en producción. `registrar` sirve solamente para una puesta en marcha controlada.
- `WHATSAPP_DEFAULT_COUNTRY_CODE`: `549` normaliza números móviles argentinos.

Las credenciales vigentes de IMPRESS están en el proyecto Vercel `impress-crm`. Al migrarlas, mapear
`WHATSAPP_ACCESS_TOKEN` → `META_WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET` → `META_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN` → `META_WEBHOOK_VERIFY_TOKEN` y `WHATSAPP_API_VERSION` → `META_GRAPH_VERSION`.
No reutilizar credenciales de Amedex ni las de la cuenta de prueba de Meta.

## 3. Webhook de Meta

En la aplicación de Meta configurar como Callback URL:

```text
https://impress-pedidos.vercel.app/api/whatsapp/webhook
```

Si el dominio productivo es otro, reemplazar el host y conservar `/api/whatsapp/webhook`.

Usar el valor de `META_WEBHOOK_VERIFY_TOKEN` como Verify Token y suscribir el campo `messages`. El endpoint acepta la verificación GET, registra mensajes entrantes y actualiza estados de entrega.

## 4. Ventana de 24 horas

La caja de respuesta envía texto libre. Meta solo permite texto libre durante las 24 horas posteriores al último mensaje del cliente. Fuera de esa ventana se necesita una plantilla aprobada. La pantalla lo advierte y conserva el error devuelto por Meta en el historial.

## 5. Prueba mínima

1. Ejecutar la migración.
2. Cargar las ocho variables anteriores.
3. Desplegar de nuevo para que Vercel tome los cambios.
4. Verificar el webhook desde Meta.
5. Enviar un mensaje al número de IMPRESS desde un teléfono de prueba.
6. Confirmar que aparece en `/whatsapp`, responder y comprobar los estados de entrega.
