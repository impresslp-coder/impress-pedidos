param(
  [string]$ProtocolUrl
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packagedExe = Join-Path $projectRoot "dist\IMPRESS Print-win32-x64\IMPRESS Print.exe"
$electronCmd = Join-Path $projectRoot "node_modules\.bin\electron.cmd"
$electronExe = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"

$preferPackagedExe = $env:IMPRESS_PRINT_USE_PACKAGED_EXE -eq "1"

if ($preferPackagedExe -and (Test-Path -LiteralPath $packagedExe)) {
  Start-Process -FilePath $packagedExe -ArgumentList @($ProtocolUrl)
  exit 0
}

if (-not (Test-Path -LiteralPath $electronExe) -and -not (Test-Path -LiteralPath $electronCmd)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "Electron no esta instalado. Ejecuta npm install en el proyecto y volve a intentar.",
    "IMPRESS Print",
    "OK",
    "Error"
  ) | Out-Null
  exit 1
}

if (Test-Path -LiteralPath $electronExe) {
  Start-Process -FilePath $electronExe -ArgumentList @(
    "`"$PSScriptRoot`"",
    "--",
    "`"$ProtocolUrl`""
  )
  exit 0
}

Start-Process -FilePath $electronCmd -ArgumentList @(
  "`"$PSScriptRoot`"",
  "--",
  "`"$ProtocolUrl`""
)
