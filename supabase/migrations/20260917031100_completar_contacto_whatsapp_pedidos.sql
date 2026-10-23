-- Los pedidos migrados conservan la vía de contacto, pero la fuente no tenía
-- una columna separada de teléfono de contacto. Para WhatsApp, el número
-- registrado del cliente es el contacto operativo del pedido.
UPDATE public.pedidos p
SET telefono_contacto = btrim(c.telefono)
FROM public.clientes c
WHERE p.cliente_id = c.id
  AND lower(btrim(coalesce(p.via_contacto, ''))) = 'whatsapp'
  AND nullif(btrim(coalesce(p.telefono_contacto, '')), '') IS NULL
  AND nullif(btrim(coalesce(c.telefono, '')), '') IS NOT NULL;
