param(
  [string]$ProtocolUrl
)

$ErrorActionPreference = "Stop"

# Launcher para la version distribuida (carpeta compilada).
# El .exe esta en la misma carpeta que este script.
$exe = Join-Path $PSScriptRoot "IMPRESS Print.exe"

if (-not (Test-Path -LiteralPath $exe)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "No se encontro IMPRESS Print.exe en la carpeta: $PSScriptRoot`nAsegurate de que este script este en la misma carpeta que el ejecutable.",
    "IMPRESS Print",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

Start-Process -FilePath $exe -ArgumentList @($ProtocolUrl)
