# PrinterAuto Windows Connector Installer

## Current status: NOT AVAILABLE

This repository currently contains the connector source at `../connector/agent.py`, but it does **not** contain a compiled `.exe`, `.msi`, signed installer, release artifact or official installer download endpoint. A ZIP/source checkout is not an installer and must not be presented to Shopkeepers as one.

The Shopkeeper wizard therefore reports `Signed Windows installer: not available` and does not provide a guessed download URL.

## Required production build process

The release owner must complete these steps on a controlled Windows build host:

1. Pin and review the Python/runtime dependencies. Run the repository security and connector tests.
2. Build a Windows executable with a pinned PyInstaller version from a clean checkout, for example:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements-windows.txt
   .\.venv\Scripts\python.exe -m PyInstaller --clean --onefile --name PrinterAutoConnector ..\connector\agent.py
   ```

3. Package the executable with a reviewed installer technology such as WiX or Inno Setup. The installer must:
   - check Windows version and architecture;
   - check the required runtime/dependencies;
   - request administrator approval only when required;
   - never silently install a printer driver or change system settings;
   - install to a controlled directory and create a least-privilege service/start-menu entry only after explicit consent;
   - include a clear uninstall path;
   - preserve the connector token with restrictive permissions;
   - provide a health-check action and safe log location without customer document contents.

4. Sign the executable and installer with the organization’s code-signing certificate. Record the certificate identity, signing timestamp and SHA-256 digest.
5. Verify the signature on a clean Windows 10 and Windows 11 machine, then run pairing, printer detection, heartbeat, test-print, offline and revoke tests.
6. Publish the signed artifact to an authenticated release endpoint with immutable versioned URLs. Generate a server-maintained manifest containing version, URL, SHA-256 and signature status.
7. Only after the above evidence exists should the Shopkeeper wizard change the installer status from `NOT_AVAILABLE` to `AVAILABLE`.

## Build blockers

- No pinned `requirements-windows.txt` with hashes is currently committed.
- No PyInstaller/WiX/Inno build environment is available in this Linux sandbox.
- No code-signing certificate or signing identity is configured.
- No official release bucket/CDN, update manifest or authenticated download endpoint is configured.
- No physical Windows printer test host is available here.

These are real blockers, not simulated test results. The source connector can still be inspected and syntax-tested, but it is not a signed Windows product installer.
