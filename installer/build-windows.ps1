# PrinterAuto Connector Windows release build
# Signed mode is required for any production release. Unsigned mode is only for CI/local test artifacts.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Version,
  [string]$SigningCertificateThumbprint = '',
  [string]$OutputDirectory = 'release',
  [switch]$AllowUnsignedTestBuild
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$connector = Join-Path $root 'connector\agent.py'
$requirements = Join-Path $root 'requirements-windows.txt'
$iss = Join-Path $PSScriptRoot 'PrinterAutoConnector.iss'
$unsignedTest = [string]::IsNullOrWhiteSpace($SigningCertificateThumbprint)
if ($unsignedTest -and -not $AllowUnsignedTestBuild) { throw 'A code-signing certificate thumbprint is required. Use -AllowUnsignedTestBuild only for non-release CI/local testing.' }
if (-not (Test-Path $connector)) { throw 'connector/agent.py not found' }
if (-not (Test-Path $requirements)) { throw 'Pinned requirements-windows.txt is required; refusing a floating build' }
if (-not (Test-Path $iss)) { throw 'Reviewed Inno Setup script is missing; no installer will be published' }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Python launcher is required on the controlled Windows build host' }
if (-not (Get-Command iscc -ErrorAction SilentlyContinue)) { throw 'Inno Setup is required; refusing to call source or ZIP an installer' }
if (-not $unsignedTest -and -not (Get-Command signtool -ErrorAction SilentlyContinue)) { throw 'Windows SDK signtool is required for signed builds' }
$work = Join-Path $env:TEMP ("printerauto-build-" + [guid]::NewGuid().ToString('N'))
$out = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force $out | Out-Null
New-Item -ItemType Directory -Force $work | Out-Null
try {
  py -3.11 -m venv (Join-Path $work '.venv')
  $python = Join-Path $work '.venv\Scripts\python.exe'
  & $python -m pip install --disable-pip-version-check --require-hashes -r $requirements
  $versionFile = Join-Path $work 'version.txt'
  Set-Content -Path $versionFile -Value $Version -NoNewline
  $dist = Join-Path $work 'dist'
  & $python -m PyInstaller --clean --onefile --name PrinterAutoConnector --add-data "$versionFile;." --distpath $dist $connector
  $exe = Join-Path $dist 'PrinterAutoConnector.exe'
  if (-not (Test-Path $exe)) { throw 'PyInstaller did not produce the executable' }
  if (-not $unsignedTest) {
    & signtool sign /sha1 $SigningCertificateThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $exe
    & signtool verify /pa /all $exe
    if ($LASTEXITCODE -ne 0) { throw 'Authenticode verification failed for connector executable' }
  }
  $env:PRINTERAUTO_CONNECTOR_VERSION = $Version
  Remove-Item -Recurse -Force (Join-Path $PSScriptRoot 'out') -ErrorAction SilentlyContinue
  & iscc /DAppVersion=$Version /DSourceExe=$exe $iss
  $installer = Get-ChildItem -Path (Join-Path $PSScriptRoot 'out') -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $installer) { throw 'Installer artifact was not produced' }
  if (-not $unsignedTest) {
    & signtool sign /sha1 $SigningCertificateThumbprint /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $installer.FullName
    & signtool verify /pa /all $installer.FullName
    if ($LASTEXITCODE -ne 0) { throw 'Authenticode verification failed for installer' }
  }
  $artifact = Join-Path $out ("PrinterAutoConnector-$Version.exe")
  Copy-Item $installer.FullName $artifact -Force
  $hash = (Get-FileHash $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
  [pscustomobject]@{
    version = $Version
    artifact = (Split-Path $artifact -Leaf)
    sha256 = $hash
    signed = (-not $unsignedTest)
    productionEligible = (-not $unsignedTest)
    signature = if ($unsignedTest) { 'NOT_VERIFIED_TEST_BUILD' } else { 'VERIFIED' }
  } | ConvertTo-Json | Set-Content (Join-Path $out 'manifest.json')
  Write-Host ("Built {0}; signed={1}; productionEligible={2}" -f $artifact, (-not $unsignedTest), (-not $unsignedTest))
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
