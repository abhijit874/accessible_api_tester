; Inno Setup script for Accessible API Tester
; Compile with: ISCC.exe installer\AccessibleApiTester.iss
; Expects a self-contained publish in the "publish" folder (see publish.ps1).

#define AppName "Accessible API Tester"
#define AppVersion "1.0.0"
#define AppPublisher "Accessible API Tester"
#define AppExeName "AccessibleApiTester.Desktop.exe"
#define PublishDir "..\publish"

[Setup]
AppId={{B3F2A1D4-7C8E-4A9B-9D1F-2E5C6A7B8D90}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Per-machine install needs admin; switch to "lowest" + {userpf} for per-user.
PrivilegesRequired=admin
OutputDir=..\dist
OutputBaseFilename=AccessibleApiTester-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Recursively bundle the entire self-contained publish output.
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
// WebView2 runtime is built into Windows 11 and most updated Windows 10 (via Edge).
// Warn — but do not block — if the Evergreen runtime is not detected.
function IsWebView2Installed(): Boolean;
var
  Value: string;
begin
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Value) or
    RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Value) or
    RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Value);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not IsWebView2Installed() then
    MsgBox('The Microsoft Edge WebView2 Runtime was not detected.' + #13#10 +
           'It is normally already present on Windows 11. If the app fails to start,' + #13#10 +
           'install the free "Evergreen" WebView2 Runtime from microsoft.com.',
           mbInformation, MB_OK);
end;
