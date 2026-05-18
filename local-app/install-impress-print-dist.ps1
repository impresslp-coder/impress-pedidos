param()

$ErrorActionPreference = "Stop"

$launcherPath = Join-Path $PSScriptRoot "impress-print-launcher-dist.ps1"
if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "No se encontro el launcher en: $launcherPath`nAsegurate de que ambos .ps1 esten en la misma carpeta que IMPRESS Print.exe"
}

$protocolRoot = "HKCU:\Software\Classes\impress-print"
$commandPath  = Join-Path $protocolRoot "shell\open\command"
$iconPath     = Join-Path $protocolRoot "DefaultIcon"

New-Item -Path $protocolRoot -Force | Out-Null
Set-Item  -Path $protocolRoot -Value "URL:IMPRESS Print"
New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

New-Item -Path $iconPath -Force | Out-Null
Set-Item  -Path $iconPath -Value "imageres.dll,-102"

New-Item -Path $commandPath -Force | Out-Null
$command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" `"%1`""
Set-Item  -Path $commandPath -Value $command

Write-Host "IMPRESS Print instalado correctamente."
Write-Host "El boton Imprimir ya puede abrir la app desde el navegador."
