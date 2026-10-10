# PrinterAuto Windows Connector Installer

## Current status: NOT AVAILABLE

This repository contains the connector source and a reproducible Windows build process, but it does **not** currently contain a public compiled installer, signed release, official download endpoint or physical-printer test evidence.

The Shopkeeper wizard therefore keeps the download action disabled and shows **“Download PrinterAuto Connector — अभी उपलब्ध नहीं”**. A ZIP/source checkout and an unsigned CI artifact are not approved installers.

## Easiest build path: GitHub Actions

`.github/workflows/windows-connector-build.yml` runs on GitHub’s `windows-2022` hosted runner. It uses CPython `3.11.9`, the pinned hashed packages in `requirements-windows.txt`, and Inno Setup `6.2.2`.

From the repository’s GitHub page:

1. Click **Actions**.
2. Select **Windows Connector Build**.
3. Click **Run workflow**.
4. Select the feature branch to test.
5. Enter a new semantic test version such as `0.0.0-test.1`.
6. Leave signed mode unchecked for an unsigned test build.
7. Open the completed run and download the artifact from **Artifacts**.

The resulting artifact is named `PrinterAutoConnector-<version>-unsigned-test`. It is a real Windows-built test artifact, but it is **not signed, not production eligible and must not be published or given to customers**.

A signed release candidate can be built only when the organization’s security owner configures the encrypted GitHub Actions secrets documented in [`WINDOWS_RELEASE_OPERATOR_GUIDE.md`](WINDOWS_RELEASE_OPERATOR_GUIDE.md). The signed workflow imports the certificate temporarily, signs and verifies the executable and installer, runs `verify-release.ps1`, and removes temporary certificate material. Private keys and passwords must never be committed or printed.

A green GitHub Actions run is still not a public release. Clean Windows 10/11 install, upgrade, uninstall, pairing, shop-isolation, offline-recovery and real USB/network printer tests are still required.

## Local/controlled Windows build process

The release owner may run the fail-closed scripts on an approved Windows host:

1. Install CPython 3.11 x64, Inno Setup and Windows SDK `signtool`.
2. Run the repository tests.
3. Run `installer/build-windows.ps1` with a new version and an organization-approved certificate thumbprint.
4. Run `installer/verify-release.ps1` against the generated installer and manifest.
5. Complete clean Windows and physical printer testing.
6. Publish only the signed, independently verified artifact to an immutable HTTPS URL containing the version.
7. Configure the server-side release manifest only after all evidence is reviewed.

The build script supports `-AllowUnsignedTestBuild` only for local/CI test artifacts. It refuses to treat that output as production eligible. `verify-release.ps1` always requires `signtool` and a valid Authenticode signature.

## Security controls

- Python dependencies are pinned with exact wheel hashes and installed with `--require-hashes`.
- Production builds require Authenticode signing and verification of both the frozen executable and installer.
- The installer is per-user (`PrivilegesRequired=lowest`) and does not silently install printer drivers or change printer settings.
- No API keys, service-role keys, shop credentials, payment secrets or permanent tokens are embedded.
- The Shopkeeper download contract accepts only a verified HTTPS versioned URL with a recorded SHA-256 and signature status.
- The UI remains `NOT_AVAILABLE` until the verified artifact is published and the required Windows/printer evidence exists.

## Current blockers

- No Windows build has actually run in this sandbox; the workflow is configured but not yet executed.
- No organization signing certificate is configured in this task.
- No official release bucket/CDN or authenticated download endpoint is configured.
- No Windows 10/11 installation evidence or physical USB/network printer evidence is available.

These are real blockers, not simulated results. See the [operator guide](WINDOWS_RELEASE_OPERATOR_GUIDE.md) and [release checklist](../WINDOWS_INSTALLER_RELEASE_CHECKLIST.md) for the exact next steps.
