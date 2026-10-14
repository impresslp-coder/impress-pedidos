# Panel de Biblioteca Virtual

La página `/admin/biblioteca` administra exclusivamente el proyecto Supabase `impress-biblioteca` (`eeeboruicdpeetepellf`). El acceso exige sesión activa de ImpressOffice y `usuarios_sistema.rol = admin`, `activo = true`, verificados en el servidor contra `web-impress`. Ningún navegador recibe la clave secreta de Biblioteca.

## Configuración

- `BIBLIOTECA_SUPABASE_URL`: URL del proyecto nuevo.
- `BIBLIOTECA_SUPABASE_SECRET_KEY`: clave `sb_secret_` del proyecto nuevo, solo servidor. Está en `.env.local` ignorado por Git y como Secret de producción del proyecto Vercel `impress-pedidos`.

Las funciones de administración leen y escriben únicamente `bv_categories`, `bv_library_items` y los buckets privados `biblioteca-pdf` y `biblioteca-portadas` del proyecto nuevo. El único acceso a `web-impress` es la comprobación del rol del empleado; no se modifican sus tablas ni políticas.

## Carga e importación

El navegador obtiene URLs firmadas de subida de corta duración, envía el PDF (máximo 50 MB) y una portada JPEG generada de la primera página directamente al Storage privado. El servidor descarga ambos archivos, comprueba su firma y tamaño, cuenta las páginas con `pdf-lib` (compatible con Node en Vercel) y recién entonces crea o actualiza el material. Reemplazar un archivo conserva su registro y contador de descargas; los archivos anteriores se retiran tras actualizarlo. No hay claves secretas en el cliente.

Para cargar por lote, primero crear las categorías necesarias, seleccionar un CSV y los PDF correspondientes. Encabezados:

```csv
archivo,titulo,descripcion,nivel,institucion,carrera,materia,anio,estado
apunte.pdf,Apunte de prueba,Resumen,Universitario,UNLP,Derecho,Introducción,2026,borrador
```

Los nombres de categorías deben coincidir con categorías activas; las columnas institución, carrera, materia y año pueden quedar vacías. `estado` acepta `publicado` o `borrador`. El nombre de archivo debe coincidir exactamente con uno de los PDF seleccionados. El panel procesa hasta tres archivos a la vez y muestra progreso y errores por archivo; no envía archivos grandes a través de la función de Vercel.

## Verificación y pendientes

- `npx tsc --noEmit --pretty false` y `npm run build` pasaron con las rutas nuevas.
- La conexión de servidor con el proyecto Biblioteca y una subida/lectura/borrado mediante URL firmada se probaron contra el proyecto nuevo.
- Sin sesión, el panel redirige a login y la API responde 403.
- El commit `6d2d7d8` se desplegó como producción **sin promover el dominio principal** en `dpl_3acim6VgeAHrWuWnLkjDAagENa7C`. Con sesión admin se comprobó la edición y publicación. La primera subida real llegó a Storage pero `finalize` devolvió 503: los logs mostraron `ReferenceError: DOMMatrix is not defined` al importar `pdfjs-dist` en Node. El commit `370aaaf` reemplaza únicamente el conteo servidor por `pdf-lib`; un PDF local de 136 páginas se leyó correctamente y la compilación pasó. El despliegue corregido está en `dpl_6sfoPZZDyrY9ALyRn7tANq9SrL73` (`https://impress-pedidos-51vrkz3l5-impressonline.vercel.app`).
- El despliegue corregido se promovió a `impress-pedidos.vercel.app` el 14/10/2026 tras comprobar la compilación y el conteo local del PDF que había fallado. La subida completa desde el panel sigue pendiente de repetición manual con sesión admin. El repositorio principal conserva numerosos cambios preexistentes sin confirmar; no incluirlos inadvertidamente en otro commit o despliegue.
