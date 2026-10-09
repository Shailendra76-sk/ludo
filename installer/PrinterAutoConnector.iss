; PrinterAuto Connector installer template.
; The build script signs both the executable and this generated installer before release.
#define AppName "PrinterAuto Connector"
#define AppPublisher "PrinterAuto"
#define AppExeName "PrinterAutoConnector.exe"
#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef SourceExe
  #error SourceExe must be supplied by installer/build-windows.ps1
#endif

[Setup]
AppId={{A5E3A1D2-2DB8-4D9D-9D70-1234567890AB}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\PrinterAuto\Connector
DefaultGroupName={#AppName}
OutputDir=out
OutputBaseFilename=PrinterAutoConnector-{#AppVersion}-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
Uninstallable=yes
UninstallDisplayName={#AppName} {#AppVersion}
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=Shop-bound PrinterAuto outbound connector
VersionInfoCopyright=Copyright (c) PrinterAuto

[Files]
Source: "{#SourceExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\SHOPKEEPER_PRINTER_SETUP.md"; DestDir: "{app}\docs"; Flags: isreadme

[Icons]
Name: "{group}\PrinterAuto Connector health check"; Filename: "{app}\{#AppExeName}"; Parameters: "--health-check"
Name: "{group}\Pair PrinterAuto Connector"; Filename: "{app}\{#AppExeName}"; Parameters: "--help"
Name: "{group}\Uninstall PrinterAuto Connector"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#AppExeName}"; Parameters: "--health-check"; Description: "Run a local connector health check"; Flags: postinstall skipifsilent nowait

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
; The per-user pairing token is deliberately not deleted by this section.
; An uninstall operator must explicitly revoke the connector in Printer Management,
; then delete %USERPROFILE%\.printer-auto-connector.json if local token removal is required.
