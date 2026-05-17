param()

$ErrorActionPreference = "Stop"

$launcherPath = Join-Path $PSScriptRoot "impress-print-launcher.ps1"
if (-not (Test-Path -LiteralPath $launcherPath)) {
  throw "No se encontro el launcher en: $launcherPath"
}

$protocolRoot = "HKCU:\Software\Classes\impress-print"
$commandPath = Join-Path $protocolRoot "shell\open\command"
$iconPath = Join-Path $protocolRoot "DefaultIcon"

New-Item -Path $protocolRoot -Force | Out-Null
Set-Item -Path $protocolRoot -Value "URL:IMPRESS Print"
New-ItemProperty -Path $protocolRoot -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

New-Item -Path $iconPath -Force | Out-Null
Set-Item -Path $iconPath -Value "imageres.dll,-102"

New-Item -Path $commandPath -Force | Out-Null
$command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" `"%1`""
Set-Item -Path $commandPath -Value $command

Write-Host "IMPRESS Print instalado."
Write-Host "El boton Imprimir ya puede abrir enlaces impress-print:// desde el sistema."
