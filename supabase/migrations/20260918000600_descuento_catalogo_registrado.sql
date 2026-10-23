-- Por estar digitalizados y registrados, los apuntes del catálogo reciben un
-- descuento configurable. No se alteran sus precios de lista ni los servicios.
INSERT INTO configuracion (clave, valor)
VALUES ('catalogo_descuento_registrado_pct', '20')
ON CONFLICT (clave) DO NOTHING;
