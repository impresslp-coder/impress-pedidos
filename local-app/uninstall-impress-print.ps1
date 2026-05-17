param()

$ErrorActionPreference = "Stop"

$protocolRoot = "HKCU:\Software\Classes\impress-print"
if (Test-Path -LiteralPath $protocolRoot) {
  Remove-Item -LiteralPath $protocolRoot -Recurse -Force
  Write-Host "IMPRESS Print desinstalado."
} else {
  Write-Host "IMPRESS Print no estaba instalado."
}
