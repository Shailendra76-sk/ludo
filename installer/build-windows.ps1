# PrinterAuto Connector Windows release build
# This script intentionally fails closed unless a clean build, signing identity and artifact checks are present.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$SigningCertificateThumbprint,
  [string]$OutputDirectory = "release"
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$connector = Join-Path $root 'connector\agent.py'
$requirements = Join-Path $root 'requirements-windows.txt'
$iss = Join-Path $PSScriptRoot 'PrinterAutoConnector.iss'
if (-not (Test-Path $connector)) { throw 'connector/agent.py not found' }
if (-not (Test-Path $requirements)) { throw 'Pinned requirements-windows.txt is required; refusing a floating build' }
if (-not (Test-Path $iss)) { throw 'Reviewed Inno Setup script is missing; no installer will be published' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Python launcher is required on the controlled Windows build host' }
if (-not (Get-Command signtool -ErrorAction SilentlyContinue)) { throw 'Windows SDK signtool is required; refusing to make an unsigned release' }
if (-not (Get-Command iscc -ErrorAction SilentlyContinue)) { throw 'Inno Setup is required; refusing to call source or ZIP an installer' }
if ([string]::IsNullOrWhiteSpace($SigningCertificateThumbprint)) { throw 'A code-signing certificate thumbprint is required' }
$work = Join-Path $env:TEMP ("printerauto-build-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work | Out-Null
try {
  py -3.11 -m venv (Join-Path $work '.venv')
  $python = Join-Path $work '.venv\Scripts\python.exe'
  & $python -m pip install --disable-pip-version-check --require-hashes -r $requirements
  $versionFile = Join-Path $work 'version.txt'
  Set-Content -Path $versionFile -Value $Version -NoNewline
  & $python -m PyInstaller --clean --onefile --name PrinterAutoConnector --add-data "$versionFile;." --distpath (Join-Path $work 'dist') $connector
  $exe = Join-Path $work 'dist\PrinterAutoConnector.exe'
  if (-not (Test-Path $exe)) { throw 'PyInstaller did not produce the executable' }
  & signtool sign /sha1 $SigningCertificateThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $exe
  & signtool verify /pa /all $exe
  $env:PRINTERAUTO_CONNECTOR_VERSION = $Version
  & iscc /DAppVersion=$Version /DSourceExe=$exe $iss
  $installer = Get-ChildItem -Path (Join-Path $PSScriptRoot 'out') -Filter '*.exe' | Select-Object -First 1
  if (-not $installer) { throw 'Installer artifact was not produced' }
  & signtool sign /sha1 $SigningCertificateThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $installer.FullName
  & signtool verify /pa /all $installer.FullName
  New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
  Copy-Item $installer.FullName (Join-Path $OutputDirectory ("PrinterAutoConnector-$Version.exe"))
  $hash = (Get-FileHash (Join-Path $OutputDirectory ("PrinterAutoConnector-$Version.exe")) -Algorithm SHA256).Hash
  [pscustomobject]@{ version=$Version; artifact="PrinterAutoConnector-$Version.exe"; sha256=$hash; signed=$true } | ConvertTo-Json | Set-Content (Join-Path $OutputDirectory 'manifest.json')
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
