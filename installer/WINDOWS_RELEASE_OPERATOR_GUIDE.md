# PrinterAuto Windows Connector Release Operator Guide

This guide is for the person who will perform the **actual Windows build and release**. It assumes basic Windows familiarity but no packaging expertise.

> **Important:** This guide does not mean an installer already exists. The current product status is `NOT_AVAILABLE`. Do not publish or enable download until every acceptance item is backed by evidence.

## 1. What you need before starting

### Hardware and access

- A dedicated, access-controlled Windows 11 x64 build machine, preferably freshly installed and fully patched.
- A separate clean Windows 10 x64 test machine or VM.
- A separate clean Windows 11 x64 test machine or VM.
- At least one real USB printer and one real network printer for testing.
- Organization-approved GitHub access to `Shailendra76-sk/ludo`.
- Access to the organization’s approved release host/CDN.
- Approval from the organization’s security/release owner.

Do not use a customer workstation as the build machine. Enable BitLocker, Windows Defender and automatic updates. Do not copy customer documents to the build or test machines.

### Software

Install from official vendor sources using your organization’s normal software approval process:

1. Git for Windows.
2. CPython **3.11 x64** and the Python launcher (`py`).
3. Inno Setup with the `iscc` compiler on `PATH`.
4. Windows SDK or Visual Studio Build Tools that provide `signtool.exe`.
5. A text editor and PowerShell.

The build script deliberately stops if Python, Inno Setup or `signtool` is missing.

## 2. Prepare and protect the signing certificate

Use an organization-owned Authenticode code-signing certificate obtained through the organization’s approved certificate authority and security process. The exact certificate vendor is an organization decision.

Preferred protection, from strongest to weakest:

1. Hardware-backed signing service or HSM.
2. Non-exportable certificate in the protected Windows certificate store.
3. Organization-managed certificate installation performed by IT.

For a local build, IT may install the certificate into the build account’s **Current User → Personal** certificate store with the private key marked non-exportable. The build operator needs permission to use the key, not permission to export it.

Find the certificate thumbprint in PowerShell:

```powershell
Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.HasPrivateKey -and $_.EnhancedKeyUsageList.FriendlyName -match 'Code Signing' } |
  Select-Object Subject, Thumbprint, NotAfter, HasPrivateKey
```

Before using it, ask the security owner to confirm:

- Subject and organization are correct.
- Certificate is within its validity period.
- Code Signing enhanced key usage is present.
- Private key is accessible to the build account.
- Private key is not exportable or copied to the repository.

**Never commit or upload any of these:** `.pfx`, `.p12`, `.pvk`, `.key`, private certificate export, signing password, HSM token, or certificate backup. The build command needs only the certificate thumbprint; it does not need private key material in Git.

## 3. Check out the exact reviewed code

Open PowerShell and run:

```powershell
git clone https://github.com/Shailendra76-sk/ludo.git PrinterAuto
Set-Location .\PrinterAuto
git fetch origin
git checkout shopkeeper-printer-help-center-2026-10-09
git reset --hard 3868ababe8ed0a7707a19aaf7fa5957c8aeeb675
git status --short
git rev-parse HEAD
```

Expected full commit:

```text
3868ababe8ed0a7707a19aaf7fa5957c8aeeb675
```

The working tree must be clean. Record the full Git SHA in the release evidence.

## 4. Run repository checks before building

From the repository root:

```powershell
npm ci
npm run test:all
```

Stop if any command fails. Save the terminal output as `evidence\repository-tests.txt`.

The repository test suite checks application security, connector syntax, payment/webhook handling, shop isolation, printer evidence, installer configuration and dependency vulnerabilities. It does **not** replace Windows installation or physical printer tests.

## 4A. Easiest option: run the Windows build in GitHub Actions

The repository includes `.github/workflows/windows-connector-build.yml`. GitHub provides the Windows build machine; you do not need to own a Windows computer just to create a test artifact.

### Create an unsigned test installer

1. Open the repository on GitHub.
2. Click **Actions**.
3. In the left column, click **Windows Connector Build**.
4. Click **Run workflow**.
5. Select the feature branch `shopkeeper-printer-help-center-2026-10-09` (or the reviewed branch you intend to test).
6. Enter a new test version such as `0.0.0-test.1`.
7. Leave **Sign and verify a release candidate** unchecked.
8. Click the green **Run workflow** button.
9. Open the new run, wait for the green checkmark, then open the run’s **Artifacts** section.
10. Download the artifact named `PrinterAutoConnector-<version>-unsigned-test`.

This produces a real Windows-built installer artifact, but it is **unsigned and test-only**. Do not publish it, do not enable the website download button, and do not install it on customer machines.

### Create a signed release candidate

Only the security/release owner should do this. Before using signed mode, an administrator must add these GitHub encrypted repository or organization secrets under **Settings → Secrets and variables → Actions**:

- `PRINTERAUTO_SIGNING_CERTIFICATE_BASE64`: the organization-approved PFX certificate encoded as Base64.
- `PRINTERAUTO_SIGNING_CERTIFICATE_PASSWORD`: the PFX password.

The secrets are used only in memory on the hosted Windows runner. They must never be printed, committed, placed in an issue, or put into a workflow file. Prefer a hardware-backed or organization-managed signing service when available.

Repeat the same **Actions → Windows Connector Build → Run workflow** steps, but check **Sign and verify a release candidate**. The workflow imports the certificate into the temporary runner certificate store, signs and verifies the executable and installer, runs `verify-release.ps1`, then removes the temporary certificate and PFX file.

The artifact will be named `PrinterAutoConnector-<version>-signed-candidate`. It is still **not a public release**. It has not passed clean Windows installation, upgrade, uninstall, pairing, shop-isolation or physical-printer testing merely because the workflow is green.

### If the Actions button is missing or fails

- **Actions is disabled:** ask a repository administrator to enable Actions for the repository and allow the workflow.
- **Workflow is not listed:** confirm the workflow file exists on the selected branch and that you opened the branch’s workflow page.
- **Unsigned build fails:** open the failed step and record the error; do not bypass the pinned dependency or signing checks.
- **Signed build says secrets are missing:** do not paste certificate material into chat or logs. Ask the repository administrator/security owner to configure the two encrypted secrets.
- **Artifact download is unavailable:** the run must finish successfully before the artifact appears; a failed or cancelled run produces no approved artifact.

The workflow uploads artifacts for 14 days. Download the artifact from GitHub and save it with its manifest and workflow run URL in the release evidence folder.

## 5. Build the signed installer

Choose a new version, for example `1.0.0`. Use the organization’s release numbering policy and do not reuse a published version.

Create an evidence directory outside the source tree or in an ignored location:

```powershell
New-Item -ItemType Directory -Force .\evidence | Out-Null
$version = '1.0.0'
$thumbprint = 'REPLACE_WITH_APPROVED_CERTIFICATE_THUMBPRINT'
```

Run the fail-closed build:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installer\build-windows.ps1 `
  -Version $version `
  -SigningCertificateThumbprint $thumbprint `
  -OutputDirectory .\release
```

The script will:

1. Create a temporary Python 3.11 virtual environment.
2. Install only the exact hashed packages in `requirements-windows.txt`.
3. Build `PrinterAutoConnector.exe` with PyInstaller.
4. Embed the requested version.
5. Sign and verify the executable.
6. Package it with `PrinterAutoConnector.iss`.
7. Sign and verify the installer.
8. Copy the versioned installer into `release`.
9. Generate `release\manifest.json` with the SHA-256 digest.

If the script stops at a missing tool, certificate, installer template or verification step, **do not bypass the error** and do not create a ZIP as a substitute.

## 6. Verify the artifact independently

List the output:

```powershell
Get-ChildItem .\release
Get-Content .\release\manifest.json
```

Recompute the checksum:

```powershell
$installer = Get-ChildItem .\release\PrinterAutoConnector-*-Setup.exe | Select-Object -First 1
Get-FileHash $installer.FullName -Algorithm SHA256
```

The result must exactly match `sha256` in `release\manifest.json`.

Run the repository verifier:

```powershell
.\installer\verify-release.ps1 `
  -InstallerPath $installer.FullName `
  -ManifestPath .\release\manifest.json | Tee-Object .\evidence\release-verification.json
```

Also inspect the signature directly:

```powershell
Get-AuthenticodeSignature $installer.FullName | Format-List *
signtool verify /pa /all $installer.FullName
```

Accept only if:

- `Status` is `Valid`.
- The signer is the approved organization certificate.
- The certificate chain is trusted on the verification machine.
- SHA-256 matches independently.
- The artifact version and Git SHA are recorded together.

## 7. Clean Windows 10/11 installation test

Use clean snapshots or freshly provisioned devices. Do not test only on the build machine.

For each OS, record:

- Windows edition, version and build.
- x64 architecture.
- Test machine identifier.
- Installer filename and SHA-256.
- Signature result.
- Install timestamp.
- Installed version from the connector health check.

Test:

1. Verify the installer checksum before opening it.
2. Verify Authenticode signature in Properties → Digital Signatures.
3. Install with the default per-user location.
4. Confirm no printer driver was silently installed.
5. Open the installed **health check** shortcut.
6. Confirm `--version` reports the release version.
7. Confirm no API key, shop token or password is present in the install directory.
8. Confirm the connector does not claim a printer until Windows reports one.

Save screenshots and sanitized command output. Do not include tokens or customer file paths.

## 8. Upgrade test

1. Install the previous signed version on a clean machine.
2. Pair it with a disposable test shop.
3. Record connector ID and token state without recording the token itself.
4. Run the new versioned installer.
5. Confirm the old installation upgrades to the new version.
6. Confirm the connector configuration is not unexpectedly replaced or copied to an unsafe location.
7. Confirm the new version heartbeats to the same shop only after authorization.
8. Confirm the old version is no longer the active installed version.

If upgrade behavior is ambiguous, stop release and investigate; do not publish.

## 9. Uninstall and revocation test

1. Revoke the connector from Shopkeeper Printer Management.
2. Confirm subsequent job polling is rejected.
3. Uninstall through Windows Apps/Installed apps.
4. Confirm the application files and shortcuts are removed.
5. Confirm the documented token-retention behavior is followed. The installer does not silently decide shop revocation; revocation must be performed in the product before local token cleanup.
6. Reinstall and confirm pairing requires a new one-time code.

Record the connector ID, shop ID and timestamps, but never the bearer token.

## 10. Pairing, shop isolation and offline recovery

Use two disposable shops, Shop A and Shop B, with two separate connector installations.

- Pair connector A to Shop A and connector B to Shop B.
- Confirm each connector sees only its own shop’s jobs.
- Attempt cross-shop job/file access using the other connector token; it must be rejected.
- Revoke connector A; confirm it cannot poll, download or complete jobs.
- Stop the backend or block outbound access temporarily.
- Confirm the connector reports a safe offline message and does not claim print success.
- Restore access and confirm heartbeat recovery.
- Confirm a failed/retried job does not create duplicate printing.
- Confirm completion requires connector evidence, not a browser assertion.

## 11. Physical printer test matrix

Test each exact combination; never turn one successful model into a brand-wide support claim.

| Test ID | OS/build | Make/model | Connection | Driver/version | Windows test page | PrinterAuto test job | Evidence result | Supported claim |
|---|---|---|---|---|---|---|---|---|
| W10-USB-01 | Record | Record | USB | Record | Not run | Not run | Not run | None |
| W10-NET-01 | Record | Record | Network | Record | Not run | Not run | Not run | None |
| W11-USB-01 | Record | Record | USB | Record | Not run | Not run | Not run | None |
| W11-NET-01 | Record | Record | Network | Record | Not run | Not run | Not run | None |

For each successful test, record the exact printer name reported by Windows and the connector evidence: `printerName`, `verifiedAt`, `exitCode` and local job identifier. Do not store document contents.

## 12. Publish only after approval

After all tests pass:

1. Have a second release owner review the evidence.
2. Upload only the signed versioned installer and manifest to the approved authenticated release host.
3. Use an immutable URL containing the version.
4. Download the published artifact again from the official endpoint.
5. Recompute SHA-256 and repeat signature verification from the downloaded copy.
6. Record the URL, version, SHA-256, signer, Git SHA and test evidence.
7. Update the server-side release manifest through the approved configuration process.
8. Only after that change should the UI status move from `NOT_AVAILABLE` to `AVAILABLE`.

If any evidence is missing, leave the UI at `NOT_AVAILABLE` and document the blocker.
