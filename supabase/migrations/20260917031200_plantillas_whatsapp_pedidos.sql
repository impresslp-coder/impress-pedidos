-- Plantillas iniciales. Se insertan una sola vez para no sobrescribir ajustes
-- realizados luego desde mantenimiento.
INSERT INTO public.plantillas_mensaje (codigo, nombre, estado, cuerpo, orden, activo) VALUES
  (
    'retiro',
    'Pedido listo para retirar',
    'entrega',
    E'Hola {{nombre}}! {{pedido_listo_retiro}}\n\n{{detalle}}\n\nTe esperamos en {{sucursal_nombre}}, {{sucursal_direccion}}.\n{{sucursal_horario}}',
    1,
    TRUE
  ),
  (
    'envio',
    'Pedido listo para envío',
    'entrega',
    E'Hola {{nombre}}! {{pedido_listo}}\n\n{{detalle}}\n\nComo pediste envío, decinos qué día y en qué franja horaria te viene bien recibirlo.',
    2,
    TRUE
  )
ON CONFLICT (codigo) DO NOTHING;
