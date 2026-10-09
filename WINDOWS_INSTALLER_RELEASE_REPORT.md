# PrinterAuto Windows Connector — Release Readiness Report

**Date:** 2026-10-09  
**Repository:** `Shailendra76-sk/ludo`  
**Branch:** `shopkeeper-printer-help-center-2026-10-09`  
**Base commit verified before this work:** `7da38572790a842911b5c474719fe5ee771ef5b5`  
**Main merge:** Not performed

## Executive result

A real signed Windows installer was **not produced** in this environment. The repository now contains a pinned, fail-closed Windows build and verification process, but this Linux sandbox has no Windows build host, Inno Setup compiler, Authenticode `signtool`, code-signing certificate, Windows VM, or physical USB/network printer.

The customer-facing installer status must remain:

```text
NOT_AVAILABLE
```

No `.exe`, `.msi`, official download URL, signature, checksum manifest, or model-support claim is being presented as released.

## Operator documentation

- [Release checklist](WINDOWS_INSTALLER_RELEASE_CHECKLIST.md) separates repository work from external blockers and includes acceptance criteria.
- [Windows release operator guide](installer/WINDOWS_RELEASE_OPERATOR_GUIDE.md) explains build-machine setup, certificate protection, build, verification, Windows tests and evidence collection for a non-expert operator.

## What was implemented

- `requirements-windows.txt` pins the CPython 3.11 win_amd64 build dependencies with exact SHA-256 wheel hashes.
- `installer/build-windows.ps1`:
  - requires the pinned requirements file;
  - requires Python 3.11, Inno Setup and Windows SDK `signtool`;
  - builds the connector with PyInstaller;
  - embeds the requested version in the frozen bundle;
  - signs and verifies the executable;
  - builds a versioned Inno Setup installer;
  - signs and verifies the installer;
  - writes a SHA-256 release manifest.
- `installer/PrinterAutoConnector.iss`:
  - installs per-user with `PrivilegesRequired=lowest`;
  - does not install drivers or change printer settings silently;
  - provides health-check and pairing help shortcuts;
  - supports versioned upgrades through the stable Inno `AppId`;
  - provides an uninstall entry;
  - does not embed API keys, service-role keys, shop credentials or payment secrets.
- `installer/verify-release.ps1` verifies the published artifact’s SHA-256 and Authenticode signature.
- Connector first-run pairing remains one-time, shop-bound and token-based. Missing pairing produces a clear error.
- Connector now supports `--version` and `--health-check` without requiring backend credentials.
- Windows token permissions are hardened with `icacls`; failure to lock the token fails closed.
- Shopkeeper UI remains `NOT_AVAILABLE` until a signed, verified release is actually published.

## Artifact and release verification status

| Item | Actual result |
|---|---|
| Compiled Windows executable | **Not produced** |
| Windows installer `.exe`/`.msi` | **Not produced** |
| Artifact location | **None** |
| Authenticode signature | **Not performed — `signtool` unavailable** |
| Code-signing certificate | **Unavailable/not configured** |
| SHA-256 of released installer | **Not generated because no installer exists** |
| Official versioned download endpoint | **Not configured** |
| Release manifest | **Not generated** |
| UI installer status | **Must remain `NOT_AVAILABLE`** |

## Build environment inspection

Environment checked from the repository branch:

```text
OS: Linux 6.18.38+ x86_64
Python: 3.12.3
wine: unavailable
pwsh: unavailable
powershell: unavailable
docker: unavailable
podman: unavailable
qemu-system-x86_64: unavailable
signtool: unavailable
iscc: unavailable
```

The pinned PyInstaller dependency set was resolved and hashed for **CPython 3.11 win_amd64**, but it was not used to claim a Windows build. The Linux host cannot produce a trustworthy Windows installer/signature by itself.

## Commands actually run and results

### Local connector checks

```bash
python3 connector/agent.py --version
# 0.0.0-dev

python3 connector/agent.py --health-check
# JSON returned successfully; Linux platform, printerCount=0, no printer claims

python3 -m py_compile connector/agent.py
# passed
```

### Installer configuration checks

```bash
npm run test:installer
# passed
# pinned hashed Windows dependencies
# fail-closed build checks
# signature and SHA-256 verification
# least-privilege installer
# versioned upgrade filename
# uninstall definition
# no embedded secrets
# first-run pairing
# health-check and version commands
```

### Complete regression suite

```bash
npm run test:all && git diff --check
```

Result: **passed**.

Included results:

- JavaScript syntax checks: passed
- Python connector syntax: passed
- Production-readiness tests: passed
- System Configuration tests: passed
- Core security audit: passed
- Payment/webhook identity and replay tests: passed
- CSRF, trusted CORS, session persistence/revocation and shop isolation: passed
- `npm audit --audit-level=high`: **0 vulnerabilities**
- Control Center tests: passed
- Shopkeeper printer/help tests: passed
- Installer configuration tests: passed
- `git diff --check`: passed

## Tests that could not honestly be run here

These require a controlled Windows environment and real hardware; they remain **not run**, not passed:

- Clean Windows 10 installation
- Clean Windows 11 installation
- Installer upgrade from a prior version
- Installer uninstall and token-revocation lifecycle
- Authenticode signature verification on Windows
- USB printer discovery and real test print
- Network printer discovery and real test print
- Offline recovery on Windows
- Unauthorized shop isolation using two real connector installations
- Driver installation across printer models
- Model compatibility/support matrix

No printer model is claimed as tested or supported by this report.

## Required release steps before enabling `AVAILABLE`

1. Use a clean, access-controlled Windows 10/11 x64 build host.
2. Install CPython 3.11, Windows SDK `signtool` and Inno Setup.
3. Obtain and protect an organization-owned Authenticode code-signing certificate.
4. Run `installer/build-windows.ps1` with a new semantic version and certificate thumbprint.
5. Run `installer/verify-release.ps1` against the generated installer and manifest.
6. Verify signature and SHA-256 on clean Windows 10 and Windows 11 machines.
7. Test installation, upgrade, uninstall, first-run pairing, revoke/re-pair, offline recovery and shop isolation.
8. Run real USB and network test prints and record exact make/model/driver/Windows version/results.
9. Publish the verified installer to an authenticated, immutable, versioned official endpoint.
10. Add the verified version, URL, SHA-256 and signature status to the server-side release manifest.
11. Only then change the setup API/UI from `NOT_AVAILABLE` to `AVAILABLE`.

Until those steps are completed, the safe and truthful product behavior is to block installer download and show the documented build blocker.
