# PrinterAuto Windows Connector Release Checklist

**Current branch:** `shopkeeper-printer-help-center-2026-10-09`
**Current verified commit:** `3868ababe8ed0a7707a19aaf7fa5957c8aeeb675`
**Current UI status:** `NOT_AVAILABLE`

This checklist is intentionally split into **repository work** and **external release work**. A checkbox is not evidence by itself: every external item needs an attached log, screenshot, checksum, signature result or test record.

## A. Repository-completable work

| Done | Item | Evidence |
|---|---|---|
| [x] | Connector source reviewed | `connector/agent.py` |
| [x] | First-run one-time shop pairing exists | `--pairing-id` and `--code` flow |
| [x] | Token file permission hardening exists | `secure_config_file()` and Windows `icacls` |
| [x] | `--version` and `--health-check` exist | Local command output in release report |
| [x] | Pinned CPython 3.11 win_amd64 build dependencies | `requirements-windows.txt` with hashes |
| [x] | Fail-closed build script exists | `installer/build-windows.ps1` |
| [x] | Manual Windows-hosted CI workflow exists | `.github/workflows/windows-connector-build.yml` |
| [x] | Unsigned CI output is explicitly test-only | `-AllowUnsignedTestBuild` and `manifest.json` gate |
| [x] | Inno Setup install/upgrade/uninstall definition exists | `installer/PrinterAutoConnector.iss` |
| [x] | Signature and SHA-256 verifier exists | `installer/verify-release.ps1` |
| [x] | No-secret installer static test exists | `npm run test:installer` |
| [x] | UI remains `NOT_AVAILABLE` without verified release | Shopkeeper setup API/UI |
| [x] | Existing security and regression suite passes | `npm run test:all` |
| [x] | Non-expert operator guide and this checklist documented | This directory |

## B. Blocked external release work

These cannot be completed truthfully in the current Linux sandbox.

| Status | Required task | External requirement | Required evidence |
|---|---|---|---|
| [ ] | Build Windows executable | Clean Windows 10/11 x64 build host | PyInstaller log, version output, artifact path |
| [ ] | Run GitHub Actions unsigned test build | GitHub Actions enabled for the selected branch | Green workflow run URL and downloaded `unsigned-test` artifact |
| [ ] | Run GitHub Actions signed release-candidate build | Encrypted certificate secrets and security-owner approval | Green workflow run, `signed-candidate` artifact and verification output |
| [ ] | Package installer | Inno Setup installed on build host | `.exe` installer and compiler log |
| [ ] | Sign executable and installer | Organization-owned Authenticode certificate/private key | Signature verification output and certificate identity |
| [ ] | Protect signing key | IT-controlled certificate store, HSM or non-exportable key | Key custody record; never commit key material |
| [ ] | Generate and verify checksum | Built installer artifact | SHA-256 manifest plus independent recomputation |
| [ ] | Clean Windows installation | Windows 10 clean VM/device | Install evidence and logs |
| [ ] | Clean Windows 11 installation | Windows 11 clean VM/device | Install evidence and logs |
| [ ] | Upgrade test | Prior signed version plus new version | Before/after versions and preserved config evidence |
| [ ] | Uninstall test | Windows test machine | Uninstall result, leftover-token decision and revocation evidence |
| [ ] | Pairing/re-pair/revocation | Two controlled shops or isolated test tenants | Connector IDs, shop IDs and revoke results |
| [ ] | Offline recovery | Windows machine with backend/network interruption | Heartbeat timeline and recovery result |
| [ ] | USB printer test | Real USB printer | Exact model/driver/Windows result |
| [ ] | Network printer test | Real LAN/Wi-Fi printer | Exact model/driver/network/result |
| [ ] | Official publishing | Authenticated immutable release host/CDN | Versioned URL, access log and manifest |
| [ ] | Enable `AVAILABLE` | All above evidence reviewed | Release approval record and server manifest |

## C. Release artifact acceptance

Do not accept an artifact unless all are true:

- [ ] Version is semantic and identical in installer, executable health output and release manifest.
- [ ] Installer is built from the reviewed commit, recorded by full Git SHA.
- [ ] Executable has a valid Authenticode signature from the organization’s certificate.
- [ ] Installer has a valid Authenticode signature from the organization’s certificate.
- [ ] Signature timestamp is present and verification succeeds on a clean machine.
- [ ] SHA-256 in `manifest.json` matches an independent `Get-FileHash` result.
- [ ] Installer contains no API key, service-role key, shop token, password, certificate private key or payment secret.
- [ ] Installer does not silently install printer drivers or expose printer ports.
- [ ] First-run pairing requires a fresh shop-bound code.
- [ ] Connector receives only jobs for its paired shop.
- [ ] Revoke invalidates the connector token and prevents further job access.
- [ ] Failed print is not recorded as successful without connector evidence.
- [ ] Duplicate/replayed completion does not create duplicate printing.
- [ ] Installer status remains `NOT_AVAILABLE` until the verified release manifest is deployed.

## D. Printer support evidence matrix

One row per exact model/driver/connection type. Do not generalize from one model to a whole brand.

| Make | Exact model | Connection | Windows version/build | Architecture | Driver name/version | Install | Connector heartbeat | Test print | Failure/retry | Evidence link | Supported? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TBD | TBD | USB / Network | Windows 10/11 TBD | x64 | TBD | Not run | Not run | Not run | Not run | TBD | No claim |

## E. Final go/no-go rule

**GO** only when the signed artifact, checksum, Windows installation evidence, pairing/security evidence, offline/recovery evidence and physical printer matrix have been reviewed and the official versioned endpoint is live.

**NO-GO** if any signature, checksum, Windows, printer, shop-isolation or hosting evidence is missing. The UI must remain `NOT_AVAILABLE`.
