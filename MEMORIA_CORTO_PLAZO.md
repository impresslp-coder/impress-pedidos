# 📋 Memoria a corto plazo — cosas sin terminar

> Estado vivo de lo que está en curso, roto o pendiente de decisión.
> A diferencia de `MEMORIA_LARGO_PLAZO.md`, esto se poda seguido: cuando algo se resuelve, se borra de acá
> (el detalle histórico ya quedó en el commit o en la memoria de largo plazo si valía la pena).

---

## 🔧 En curso / recién hecho (2026-07-10)

### WhatsApp CRM (2026-10-23, rama `codex/crm-wsp`)

- Publicación preparada el 2026-10-27 sobre el `main` remoto actualizado:
  - los dos commits del CRM se integraron sobre `origin/main` en un worktree limpio, sin incluir cambios locales ajenos;
  - `npm run build` terminó correctamente y generó la ruta `/api/whatsapp/webhook`;
  - las ocho variables `META_*` / `WHATSAPP_*` se cargaron en Production del proyecto Vercel `impress-pedidos`;
  - el token permanente y el App Secret se validaron contra la app `CRM Impress` y el número real `+54 9 221 585-4997`;
  - falta apuntar el callback de Meta al endpoint productivo y comprobar recepción + respuesta dentro de una ventana nueva de 24 h.

- Primera versión implementada y con build de producción exitoso:
  - bandeja `/whatsapp` inspirada en Amedex, adaptada a clientes y pedidos;
  - conversaciones, no leídos, búsqueda, historial, estados de Meta y ventana de 24 h;
  - envío de texto desde Server Actions;
  - webhook `/api/whatsapp/webhook` con validación HMAC `X-Hub-Signature-256`;
  - vinculación automática con `clientes` por teléfono y pedidos recientes;
  - migración `supabase/migrations/20261023_whatsapp_crm.sql`;
  - guía de activación `docs/WHATSAPP_CRM.md`.
- Pendiente para activarlo en producción:
  - ejecutar manualmente la migración en el SQL Editor de Supabase;
  - copiar las credenciales propias de IMPRESS desde el proyecto Vercel `impress-crm` a `impress-pedidos`;
  - desplegar la rama y validar públicamente el callback nuevo antes de reemplazar el webhook anterior;
  - cambiar en Meta el callback de `impress-crm` a `/api/whatsapp/webhook` en `impress-pedidos`;
  - definir/crear una plantilla aprobada para iniciar conversaciones fuera de la ventana de 24 h.
- Prueba local preparada el 2026-10-23:
  - credenciales de desarrollo copiadas de `impress-crm` a `.env.development.local` (ignorado por Git);
  - token validado contra Meta para `Impress Group`, número `+54 9 221 585-4997`;
  - verificación GET y POST firmado del webhook local respondieron HTTP 200;
  - servidor local activo en `http://localhost:3000`;
  - falta ejecutar la migración del CRM en Supabase para probar bandeja y persistencia.
- La migración del CRM ya fue aplicada en Supabase y se recibió localmente el mensaje de prueba de
  `5492216001983` mediante el puente temporal desde el CRM anterior.
- El envío de texto devuelve `Meta (#200): You do not have the necessary permissions to send messages on behalf
  of this WhatsApp Business Account`. Se verificó por Graph API que el token pertenece a la app `CRM Impress`,
  tiene los scopes `whatsapp_business_management` / `whatsapp_business_messaging`, el system user `crm-impress`
  es ADMIN y tiene tarea MANAGE sobre el WABA, la app está suscripta y el número figura CONNECTED/GREEN. El mismo
  error existe en el CRM anterior desde septiembre: no es un problema de la ventana de 24 h ni del frontend nuevo.
  Próximo paso: reasignar app + WABA al usuario de sistema desde Meta Business Settings y generar un token permanente
  nuevo para `CRM Impress`; el control remoto de Chrome está deshabilitado en Work y requiere intervención manual.
- El CRM ahora bloquea también del lado servidor el texto libre fuera de la ventana de 24 h, deshabilita el botón
  cuando está cerrada y persiste el payload de error de Meta (incluidos código/subcódigo) para diagnóstico.
- Meta ya está configurado para IMPRESS: app `CRM Impress` (publicada), negocio verificado `Impress Group`,
  WABA real `Impress Group` y número real `+54 9 221 585-4997` conectado con calidad alta. Existe además una
  cuenta/número de prueba separado; no confundirlo con el real.
- Las credenciales que se deben migrar son las del proyecto Vercel `impress-crm`, no las de Amedex.

- **Botón "Impresiones personales"** en `/pedidos/nuevo/pedido` — recuperado desde un stash viejo perdido
  (ver `MEMORIA_LARGO_PLAZO.md`). Reimplementado a mano sobre la versión actual del form, verificado con
  Playwright (login, click, modal, cálculo de precio). Falta que el socio lo pruebe en un pedido real.
- **Página `/admin/precios`**:
  - Checkbox "Impresión" por parámetro (usa la columna `categoria`, ya existente en la base). Si está tildado
    se muestra el selector Simple/Doble faz; si no, "No aplica".
  - Botón "Eliminar" real (hard delete) para parámetros y sucursales — antes el DELETE de la API solo hacía
    soft-delete (`activo=false`), duplicando el toggle Activo/Inactivo que ya existía.
  - Catálogo de productos (409 productos) ahora colapsado por defecto, con buscador por nombre y paginado
    (20 por página) — antes se renderizaba la tabla completa siempre.
  - Efecto secundario (correcto, no reportado por el usuario pero necesario): `getParamIdForFaz` en
    `pedido-form.tsx` ahora solo considera parámetros con `categoria === "hojas"` al elegir automáticamente
    el precio de Simple/Doble faz — antes podía enganchar por error un parámetro no-impresión (ej. "Anillado")
    solo por venir primero en orden alfabético.

## ❓ Pendiente de decisión con el socio

- **Resto del stash rescatado, no reincorporado todavía:**
  - Matching de transferencias de Mercado Pago dentro del modal de confirmar pedido (llama a
    `/api/mercadopago/movimientos`, que **no existe** en el código actual — habría que crearlo).
  - Calculador de costo de anillado por rango de hojas (`calcAnilladoCosto` + tabla `anillado_rangos`, que
    **ya existe en la base pero está vacía** — habría que cargar rangos y construir la UI de admin + el cálculo
    en el form de pedidos).
  - Decisión pendiente: ¿se quiere recuperar esto también, o quedó descartado a propósito?
- **Mensaje ambiguo del usuario (2026-07-10):** pidió "que las sucursales también se puedan eliminar" seguido
  de `1.630.650` sin contexto. Se implementó el DELETE de sucursales; el número no se interpretó (no se sabe si
  era un monto, un teléfono, o texto pegado por error). Preguntar si hace falta algo más ahí.

## 🐛 Cosas raras vistas, no diagnosticadas a fondo

- El dev server (`npm run dev`, puerto 3000) se cayó devolviendo 500 en **todas** las rutas (incluida la home
  y APIs no tocadas) durante una sesión de pruebas con Playwright. Se reinició y volvió a andar. No se identificó
  la causa raíz — vigilar si se repite y en qué circunstancias.
