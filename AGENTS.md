# 📌 PUNTO DE RETOMA — impress-pedidos

> **Leé esto antes de tocar nada.** Frontend funcionando en dev. Supabase configurado. Próximo: seguir con features según lista de pendientes.

---

## ✅ Lo que está hecho

### Módulos completos
- **Login / Auth** — Supabase Auth + middleware proxy.ts
- **Dashboard** — stats + acciones rápidas + últimos pedidos
- **Pedidos** — lista, nuevo (con PDF resumen + ticket térmico), detalle, subida de archivos a Google Drive
- **Clientes** — lista con búsqueda, alta
- **Encargos** (`/encargos`) — catálogo de apuntes/libros, modos de precio (parametros_precio), agregar/editar/borrar (admin), foto
- **Productos** (`/productos`) — artículos de librería, precio fijo, agregar/editar/borrar (admin), foto
- **Ventas** (`/ventas`) — POS supermercado: grilla de productos, carrito, descuento por ítem, medio de pago, código de operador, descuenta stock
- **Presupuestos** — form + guarda en Supabase
- **Terciarizados** — lista + nuevo encargo
- **Reclamos** — form + historial
- **Admin → Usuarios** — solo admin, lista + invitar + editar rol

### Infraestructura
- Supabase (Postgres + Auth + RLS)
- Google Drive — upload de archivos de pedidos + fotos de productos
- Upload context en layout — subidas no bloqueantes con progress
- PDF: resumen A4 + ticket térmico 72mm generados al crear pedido

---

## 🗄️ Schema — tablas y columnas importantes

```
usuarios_sistema    — id=auth.uid(), nombre, rol, codigo_personal
clientes            — codigo, nombre, telefono, mail
productos           — nombre, tipo ('encargo'|'producto'), paginas, precio,
                      precio_compra, descuento_maximo, foto_url, activo
stock               — producto_id (FK), cantidad  ← 1:1 con productos
parametros_precio   — nombre, precio, divisor, activo  ← modos de encargos
pedidos             — numero, cliente_id, estado, seña, medio_pago,
                      sucursal_retiro, sucursal_produccion, codigo_unico,
                      quien_cargo_codigo, mensaje, prioridad
items_pedido        — pedido_id, producto, modo, paginas, precio, descuento, anotacion
ventas              — numero_venta, total, medio_pago, usuario_id
items_venta         — venta_id, producto_id, producto_nombre, cantidad,
                      precio_venta, descuento_pct, total
counters            — función next_counter(p_nombre) para numeración correlativa
```

### Migraciones ya corridas (además del schema original)
```sql
ALTER TABLE productos ADD COLUMN tipo TEXT DEFAULT 'encargo',
  ADD COLUMN precio NUMERIC(10,2), ADD COLUMN descuento_maximo NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN foto_url TEXT, ADD COLUMN precio_compra NUMERIC(10,2);
ALTER TABLE items_venta ADD COLUMN descuento_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN producto_id UUID REFERENCES productos(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN medio_pago TEXT;
ALTER TABLE usuarios_sistema ADD COLUMN codigo_personal TEXT;
ALTER TABLE pedidos ADD COLUMN codigo_unico TEXT, ADD COLUMN quien_cargo_codigo TEXT,
  ADD COLUMN medio_pago TEXT, ADD COLUMN via_contacto TEXT,
  ADD COLUMN prioridad TEXT DEFAULT 'normal', ADD COLUMN mensaje TEXT,
  ADD COLUMN telefono_contacto TEXT, ADD COLUMN sucursal_produccion TEXT,
  ADD COLUMN sucursal_retiro TEXT;
CREATE TABLE parametros_precio (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL, precio NUMERIC(10,4) NOT NULL,
  divisor NUMERIC(10,4) NOT NULL DEFAULT 1, activo BOOLEAN DEFAULT TRUE);
```

---

## 🚀 Arrancar en local

```cmd
cd C:\dev\impress-pedidos
npm run dev
```

Variables en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
```

---

## 🎨 Colores

- **Primario**: `#1a1a2e` (azul noche)
- **Acento**: `#f5a623` (amarillo imprenta)

---

## ⚠️ Particularidades técnicas

1. **Next 16**: middleware se llama `proxy.ts` (no `middleware.ts`)
2. **`cookies()` es asíncrono** — siempre `await cookies()`
3. **`suppressHydrationWarning`** en html, body, inputs
4. **`typescript.ignoreBuildErrors: true`** — conflictos con Supabase admin client genérico
5. **RLS habilitado** en todas las tablas
6. **Counter thread-safe**: `rpc("next_counter", { p_nombre: "..." })`
7. **Upload de archivos**: va a `/api/archivos/upload` (server-side proxy a Google Drive, no directo desde browser — CORS)
8. **Ventas usa tabla `stock`** (no `stock_utiles`) — `stock_utiles` quedó obsoleta
9. **`tipo` en productos**: `'encargo'` para Encargos, `'producto'` para el POS de Ventas

## ✋ Lo que NO hay que hacer
1. No meter el proyecto en Google Drive / OneDrive (node_modules explota)
2. No reproducir service_role key en código cliente
3. No renombrar `proxy.ts` a `middleware.ts`
4. No hacer XHR directo a googleapis.com desde el browser (CORS bloqueado)

---

*Actualizado: Mayo 2026.*
