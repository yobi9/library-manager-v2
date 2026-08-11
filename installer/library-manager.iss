; -----------------------------------------------------------------------------
; Library Manager V2 — Inno Setup installer script
;
; Builds a single "Setup.exe" that:
;   - Installs the standalone Next.js app into {commonappdata}\LibraryManager
;   - Registers a Windows service via the bundled nssm.exe (auto-start on boot)
;   - Opens the configured TCP port in Windows Firewall
;   - Generates a per-machine .env.production (random JWT secret, LAN IP, port)
;   - Creates Start Menu + desktop shortcuts that open the browser
;
; Pre-requisites at build time:
;   1. Run:  npm run release          (produces release\app\ via build-release.mjs)
;   2. ISCC.exe (Inno Setup 6) on PATH or set INNO_ISCC env var.
;
; Usage:   ISCC.exe installer\library-manager.iss
; -----------------------------------------------------------------------------

#define MyAppName "Library Manager V2"
#define MyAppNameShort "LibraryManager"
#define MyAppPublisher "Library Manager"
#define MyAppServiceName "LibraryManagerV2"
#define MyAppFirewallRule "Library Manager V2"
; Passed at build time via:  ISCC /DMyAppVersion=0.1.0 installer\library-manager.iss
#ifndef MyAppVersion
#define MyAppVersion "0.1.0"
#endif
#define MyAppDir "{commonappdata}\LibraryManager"
#define MyAppDefaultPort "4000"

[Setup]
AppId={{8F4E9C2A-5D1B-4B0E-9C2D-3E7A9F2C4B8D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={#MyAppDir}
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=LibraryManager-Setup-{#MyAppVersion}
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120
SetupLogging=yes
UninstallDisplayName={#MyAppName} (Uninstall)
VersionInfoVersion={#MyAppVersion}
VersionInfoDescription={#MyAppName} Installer
CreateUninstallRegKey=yes
CloseApplications=no
RestartApplications=no
; Runs elevated so the service + firewall changes succeed on the target machine.
; `nssm` writes to HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services.
AppMutex=LibraryManagerV2_Mutex

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "arabic";  MessagesFile: "Arabic.isl"

[Tasks]
Name: "service";    Description: "تثبيت كخدمة Windows تبدأ تلقائياً مع تشغيل الجهاز";     GroupDescription: "التشغيل التلقائي:";  Flags: checkedonce
Name: "firewall";   Description: "فتح المنفذ في جدار الحماية (للمتاح من أجهزة الشبكة)";     GroupDescription: "الشبكة:";             Flags: checkedonce
Name: "desktopicon";Description: "{cm:CreateDesktopIcon}";                                   GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; App payload (from release\app). data\* is installed separately with
; onlyifdoesntexist so an upgrade never overwrites the user's database.
Source: "..\release\app\*"; DestDir: "{app}"; \
    Flags: recursesubdirs createallsubdirs; \
    Excludes: "data\*"
Source: "..\release\app\data\*"; DestDir: "{app}\data"; \
    Flags: recursesubdirs createallsubdirs onlyifdoesntexist

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "http://127.0.0.1:{code:GetInstallPort}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://127.0.0.1:{code:GetInstallPort}"; \
    Tasks: desktopicon

[Run]
; Open the app in the browser at the end of a successful install.
Filename: "http://127.0.0.1:{code:GetInstallPort}"; \
    Description: "فتح التطبيق في المتصفح"; Flags: nowait shellexec skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: dirifempty; Name: "{app}"

[Code]
// ---------------------------------------------------------------------------
// Globals collected from the wizard pages
// ---------------------------------------------------------------------------
var
  NetworkPage: TInputQueryWizardPage;
  AccountPage: TInputQueryWizardPage;
  Port: String;
  LanIP: String;
  SvcUser: String;
  SvcPass: String;
  UseCustomAccount: Boolean;
  JwtSecret: String;
  // True when a previous installation exists (upgrade/reinstall). On upgrades
  // Inno Setup skips the Tasks page, so service/firewall must be re-applied
  // unconditionally to keep the running server in sync with .env.production.
  IsUpgrade: Boolean;

// Returns the port chosen by the user (used by the [Run] browser shortcut).
function GetInstallPort(Param: String): String;
begin
  if Port = '' then
    Result := '{#MyAppDefaultPort}'
  else
    Result := Port;
end;

// ---------------------------------------------------------------------------
// Detect the primary LAN IPv4 address (best-effort, falls back to 127.0.0.1)
// ---------------------------------------------------------------------------
function GetLanIp: String;
var
  Tmp: String;
  ResultCode: Integer;
  Content: TStringList;
begin
  Result := '127.0.0.1';
  Tmp := ExpandConstant('{tmp}\lm-ip.txt');
  if Exec(
       '{sys}\powershell.exe',
       '-NoProfile -ExecutionPolicy Bypass -Command "try { ' +
         '(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ' +
         'Where-Object { $_.IPAddress -notlike ''127.*'' -and $_.IPAddress -notlike ''169.254*'' ' +
         '-and $_.AddressState -eq ''Preferred'' -and $_.PrefixOrigin -ne ''WellKnown'' } | ' +
         'Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress } catch { } | ' +
         'Out-File -Encoding ascii ' + Tmp + '"',
       '',
       SW_HIDE,
       ewWaitUntilTerminated,
       ResultCode) then begin
    Content := TStringList.Create;
    try
      Content.LoadFromFile(Tmp);
      if (Content.Count > 0) and (Trim(Content.Strings[0]) <> '') then
        Result := Trim(Content.Strings[0]);
    except
    end;
    Content.Free;
  end;
end;

// ---------------------------------------------------------------------------
// Read a KEY=VALUE line from a .env style file (first match wins).
// Returns '' when the key or file is absent.
// ---------------------------------------------------------------------------
function ReadEnvValue(const Key: String; const FilePath: String): String;
var
  Content: TStringList;
  Line: String;
  EqPos: Integer;
  I: Integer;
begin
  Result := '';
  if not FileExists(FilePath) then Exit;
  Content := TStringList.Create;
  try
    Content.LoadFromFile(FilePath);
    for I := 0 to Content.Count - 1 do begin
      Line := Trim(Content.Strings[I]);
      if (Line = '') or (Line[1] = '#') then Continue;
      EqPos := Pos('=', Line);
      if (EqPos > 1) and (Trim(Copy(Line, 1, EqPos - 1)) = Key) then begin
        Result := Trim(Copy(Line, EqPos + 1, Length(Line)));
        // Strip surrounding quotes (double or single).
        if (Length(Result) >= 2) and
           ((Result[1] = '"') or (Result[1] = Chr(39))) and
           (Result[Length(Result)] = Result[1]) then
          Result := Copy(Result, 2, Length(Result) - 2);
        Exit;
      end;
    end;
  finally
    Content.Free;
  end;
end;

// Extracts the host (IP or hostname) from an http(s) URL like
// http://192.168.1.220:4000  →  192.168.1.220. Returns '' when not parseable.
function ExtractUrlHost(const Url: String): String;
var
  SchemeEnd: Integer;
  HostEnd: Integer;
  Host: String;
  ColonPos: Integer;
begin
  Result := '';
  SchemeEnd := Pos('://', Url);
  if SchemeEnd = 0 then Exit;
  Host := Copy(Url, SchemeEnd + 3, Length(Url));
  HostEnd := 1;
  while (HostEnd <= Length(Host)) and
        (Host[HostEnd] <> '/') and (Host[HostEnd] <> ':') do
    HostEnd := HostEnd + 1;
  Host := Copy(Host, 1, HostEnd - 1);
  if Host = '' then Exit;
  ColonPos := Pos(':', Host);
  if ColonPos > 0 then Host := Copy(Host, 1, ColonPos - 1);
  Result := Host;
end;

// ---------------------------------------------------------------------------
// Generate a random hex string for the JWT secret
// ---------------------------------------------------------------------------
function RandomHex(Count: Integer): String;
var
  Chars: String;
  I: Integer;
begin
  Chars := '0123456789abcdef';
  Result := '';
  for I := 1 to Count do
    Result := Result + Chars[Random(Length(Chars)) + 1];
end;

// ---------------------------------------------------------------------------
// Build the per-machine .env.production file
// ---------------------------------------------------------------------------
procedure WriteEnvFile;
var
  Content: String;
  AppUrl: String;
begin
  AppUrl := 'http://' + LanIP + ':' + Port;
  Content :=
    'NODE_ENV=production' + #13#10 +
    'HOSTNAME=0.0.0.0' + #13#10 +
    'PORT=' + Port + #13#10 +
    'JWT_SECRET=' + JwtSecret + #13#10 +
    'JWT_EXPIRES_IN=7d' + #13#10 +
    'DATABASE_URL=./data/media_library.db' + #13#10 +
    'NEXT_PUBLIC_APP_URL=' + AppUrl + #13#10 +
    'CORS_ORIGINS=' + AppUrl + #13#10 +
    'LIVE_STREAM_BASE_URL=http://localhost:3333' + #13#10 +
    'NEXT_PUBLIC_FOLDER_PICKER_URL=http://localhost:5199' + #13#10;
  SaveStringToFile(ExpandConstant('{app}\.env.production'), Content, False);
end;

// ---------------------------------------------------------------------------
// Run nssm to register + start the Windows service
// ---------------------------------------------------------------------------
procedure InstallService;
var
  AppDir: String;
  LogDir: String;
  Cmd: String;
  ResultCode: Integer;
begin
  AppDir := ExpandConstant('{app}');
  LogDir := AppDir + '\logs';
  if not DirExists(LogDir) then CreateDir(LogDir);

  // Remove any stale registration first (fresh install or upgrade).
  // nssm remove stops + deletes in one step and tolerates running services;
  // fall back to SCM when nssm cannot (e.g. service stuck paused).
  Exec(AppDir + '\nssm.exe', 'remove {#MyAppServiceName} confirm', AppDir, SW_HIDE,
       ewWaitUntilTerminated, ResultCode);
  if ResultCode <> 0 then begin
    Exec(ExpandConstant('{sys}\sc.exe'), 'continue {#MyAppServiceName}', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#MyAppServiceName}', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#MyAppServiceName}', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
  end;

  Cmd := 'install {#MyAppServiceName} "' + AppDir + '\node.exe" "start-server.js"';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if ResultCode <> 0 then begin
    MsgBox('فشل إنشاء الخدمة (' + IntToStr(ResultCode) + '). يرجى تشغيل المثبّت كمسؤول.',
           mbError, MB_OK);
    Exit;
  end;

  Cmd := 'set {#MyAppServiceName} AppDirectory "' + AppDir + '"';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppExit Default Restart';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppRestartDelay 3000';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppStdout "' + LogDir + '\service.log"';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppStderr "' + LogDir + '\service-error.log"';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppStdoutCreationDisposition 2';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} AppStderrCreationDisposition 2';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Cmd := 'set {#MyAppServiceName} Start SERVICE_AUTO_START';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // Optional service account (needed for network share access, e.g. \\server2\...).
  if UseCustomAccount then begin
    Cmd := 'set {#MyAppServiceName} ObjectName "' + SvcUser + '" "' + SvcPass + '"';
    Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;

  Cmd := 'start {#MyAppServiceName}';
  Exec(AppDir + '\nssm.exe', Cmd, AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if ResultCode <> 0 then begin
    MsgBox('تم إنشاء الخدمة لكن فشل تشغيلها (' + IntToStr(ResultCode) +
           '). راجع ملف السجل في المجلد logs\ للحصول على التفاصيل.',
           mbError, MB_OK);
  end;
end;

// ---------------------------------------------------------------------------
// Add (or replace) the inbound firewall rule for the configured port
// ---------------------------------------------------------------------------
procedure AddFirewallRule;
var
  ResultCode: Integer;
begin
  // Fixed rule name → remove any previous occurrence before adding.
  Exec(ExpandConstant('{sys}\netsh.exe'),
       'advfirewall firewall delete rule name="{#MyAppFirewallRule}"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\netsh.exe'),
       'advfirewall firewall add rule name="{#MyAppFirewallRule}" dir=in action=allow ' +
       'protocol=TCP localport=' + Port + ' profile=private',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

// ---------------------------------------------------------------------------
// Wizard pages
// ---------------------------------------------------------------------------
procedure InitializeWizard;
var
  ParamVal: String;
  EnvPath: String;
  ExistingPort: String;
  ExistingIp: String;
begin
  // Is this an upgrade? (the previous .env.production is still on disk here)
  EnvPath := ExpandConstant('{app}\.env.production');
  IsUpgrade := FileExists(EnvPath);

  // Read the currently configured values so an upgrade pre-fills the real
  // port/IP instead of silently falling back to the defaults.
  ExistingPort := '';
  ExistingIp := '';
  if IsUpgrade then begin
    ExistingPort := ReadEnvValue('PORT', EnvPath);
    ExistingIp := ExtractUrlHost(ReadEnvValue('NEXT_PUBLIC_APP_URL', EnvPath));
  end;

  // Silent installs can pass: /PORT=4000 /IP=192.168.1.10
  //                        /SVCUSER=DOMAIN\user /SVCPASS=pass
  // Sentinel default proves the parameter was actually supplied.
  ParamVal := ExpandConstant('{param:PORT|__NONE__}');
  if ParamVal <> '__NONE__' then Port := ParamVal
  else if ExistingPort <> '' then Port := ExistingPort
  else Port := '{#MyAppDefaultPort}';

  LanIP := GetLanIp;
  ParamVal := ExpandConstant('{param:IP|__NONE__}');
  if ParamVal <> '__NONE__' then LanIP := ParamVal
  else if ExistingIp <> '' then LanIP := ExistingIp;

  ParamVal := ExpandConstant('{param:SVCUSER}');
  if ParamVal <> '' then begin
    SvcUser := ParamVal;
    UseCustomAccount := True;
  end;
  ParamVal := ExpandConstant('{param:SVCPASS}');
  if ParamVal <> '' then SvcPass := ParamVal;

  NetworkPage := CreateInputQueryPage(wpSelectTasks,
    'إعدادات الشبكة', 'المنفذ وعنوان الوصول للخدمة',
    'حدد المنفذ الذي يستمع عليه الخادم، وعنوان IP الذي تصل منه الأجهزة الأخرى.' + #13#10 +
    'عادةً يكفي الافتراضي: المنفذ {#MyAppDefaultPort} والعنوان ' + LanIP + '.');
  NetworkPage.Add('المنفذ (Port):', False);
  NetworkPage.Add('عنوان الوصول (LAN IP):', False);
  NetworkPage.Values[0] := Port;
  NetworkPage.Values[1] := LanIP;

  AccountPage := CreateInputQueryPage(NetworkPage.ID,
    'حساب الخدمة', 'الحساب الذي تعمل به الخدمة',
    'إذا كانت ملفات الوسائط على مشاركات شبكة (مثل \\server2\...) وتحتاج صلاحيات ' +
    'حساب معيّن، أدخل اسم المستخدم وكلمة المرور هنا.' + #13#10 +
    'اترك الحقلين فارغين لاستخدام حساب النظام المحلي (LocalSystem).');
  AccountPage.Add('اسم المستخدم (اختياري):', False);
  AccountPage.Add('كلمة المرور (اختياري):', True);
end;

// ---------------------------------------------------------------------------
// Stop the running service BEFORE files are copied so that nssm.exe and
// node.exe can be overwritten without a file-in-use conflict.  Without this
// the post-install nssm stop/remove may silently fail against a locked binary.
// ---------------------------------------------------------------------------
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  AppDir: String;
begin
  Result := '';
  AppDir := ExpandConstant('{app}');
  if not IsUpgrade then Exit;

  Exec(AppDir + '\nssm.exe',
       'stop {#MyAppServiceName}', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Exec(AppDir + '\nssm.exe',
       'remove {#MyAppServiceName} confirm', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortInt: Integer;
begin
  Result := True;
  if CurPageID = NetworkPage.ID then begin
    Port := NetworkPage.Values[0];
    LanIP := NetworkPage.Values[1];
    PortInt := StrToIntDef(Port, -1);
    if (Port = '') or (PortInt < 1) or (PortInt > 65535) then begin
      MsgBox('يرجى إدخال منفذ صالح بين 1 و 65535.', mbError, MB_OK);
      Result := False;
    end else if LanIP = '' then begin
      MsgBox('يرجى إدخال عنوان IP صالح.', mbError, MB_OK);
      Result := False;
    end;
  end else if CurPageID = AccountPage.ID then begin
    SvcUser := AccountPage.Values[0];
    SvcPass := AccountPage.Values[1];
    UseCustomAccount := (Trim(SvcUser) <> '');
    if UseCustomAccount and (Trim(SvcPass) = '') then begin
      MsgBox('أدخل كلمة المرور للحساب المحدد.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    JwtSecret := RandomHex(48);
    WriteEnvFile;

    // On upgrades Inno Setup skips the Tasks page and unchecks "checkedonce"
    // tasks, so the service/firewall would silently stay on the OLD port while
    // .env.production was just rewritten — the source of the port mismatch.
    // Always (re)apply them on an upgrade to converge config with the server.
    if WizardIsTaskSelected('service') or IsUpgrade then
      InstallService;

    if WizardIsTaskSelected('firewall') or IsUpgrade then
      AddFirewallRule;
  end;
end;

// ---------------------------------------------------------------------------
// Uninstall — stop/remove the service, drop the firewall rule, ask about data
// ---------------------------------------------------------------------------
var
  KeepData: Boolean;

function InitializeUninstall: Boolean;
begin
  Result := True;
  KeepData := (MsgBox(
    'هل تريد الاحتفاظ بملفات البيانات (قاعدة البيانات، التراخيص، النسخ الاحتياطية)؟' + #13#10#13#10 +
    '• نعم (موصى به): سيُنقل مجلد data\ إلى LibraryManager-data-backup قبل الحذف.' + #13#10 +
    '• لا: سيُحذف كل شيء نهائياً.' + #13#10#13#10 +
    'سيتم إيقاف الخدمة وإزالتها في كل الحالتين.',
    mbConfirmation, MB_YESNO) = IDYES);
end;

procedure CurUninstallStepChanged(CurStep: TUninstallStep);
var
  AppDir: String;
  ResultCode: Integer;
begin
  if CurStep = usUninstall then begin
    AppDir := ExpandConstant('{app}');

    // Stop + delete the service.
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#MyAppServiceName}', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
    Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#MyAppServiceName}', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);

    // Remove the firewall rule.
    Exec(ExpandConstant('{sys}\netsh.exe'),
         'advfirewall firewall delete rule name="{#MyAppFirewallRule}"',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Move data out before Inno deletes {app}.
    if KeepData and DirExists(AppDir + '\data') then
      RenameFile(AppDir + '\data', AppDir + '-data-backup');
  end;
end;

