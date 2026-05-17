# IMPRESS Print

App local minima para abrir PDFs desde el sistema web en una ventana propia de IMPRESS Print.

## Instalar en esta PC

Ejecutar desde la raiz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\local-app\install-impress-print.ps1
```

Despues, el boton **Imprimir** de un archivo del pedido abre IMPRESS Print. La app recibe un trabajo firmado desde el sistema, descarga el PDF y muestra la configuracion solicitada.

Si Windows o el navegador preguntan si queres abrir `IMPRESS Print`, aceptar y marcar recordar.

En desarrollo, el protocolo abre Electron desde `node_modules` para evitar bloqueos de SmartScreen sobre el `.exe` sin firma. Para forzar el ejecutable empaquetado:

```powershell
$env:IMPRESS_PRINT_USE_PACKAGED_EXE='1'
```

Para distribuirlo en otras PCs sin advertencias de SmartScreen hace falta firmar el ejecutable con un certificado de firma de codigo.

## Desinstalar

```powershell
powershell -ExecutionPolicy Bypass -File .\local-app\uninstall-impress-print.ps1
```
