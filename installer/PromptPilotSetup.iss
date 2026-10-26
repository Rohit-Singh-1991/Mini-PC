#define MyAppName "PromptPilot Local Agent"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "DigiCreators"
#define MyAppURL "https://inapp-pc.vercel.app"

[Setup]
AppId={{6D52D4B7-8C51-4D96-A8FD-9D1528A0D641}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=https://github.com/Rohit-Singh-1991/Mini-PC/issues
AppUpdatesURL=https://github.com/Rohit-Singh-1991/Mini-PC/releases
DefaultDirName={localappdata}\PromptPilotAgent
DefaultGroupName=PromptPilot
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
OutputDir=..\dist-installer
OutputBaseFilename=PromptPilotSetup
UninstallDisplayName=PromptPilot Local Agent
SetupLogging=yes
CloseApplications=no
Uninstallable=yes

[Types]
Name: "full"; Description: "Full install (browser automation + PC control)"
Name: "browser"; Description: "Browser automation only"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "agent"; Description: "PromptPilot local agent and browser dependencies"; Types: full browser custom; Flags: fixed
Name: "pcvision"; Description: "Install llava:7b vision model for desktop capture and PC control (several GB)"; Types: full custom

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\agent\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "install-agent.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-agent.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "start-tunnel.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Start PromptPilot Agent"; Filename: "{app}\start-agent.bat"; WorkingDir: "{app}"
Name: "{group}\Start PromptPilot Tunnel"; Filename: "{app}\start-tunnel.bat"; WorkingDir: "{app}"
Name: "{group}\Open PromptPilot Dashboard"; Filename: "https://inapp-pc.vercel.app"; Flags: shellexec
Name: "{autodesktop}\PromptPilot Agent"; Filename: "{app}\start-agent.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Params: String;
begin
  if CurStep = ssPostInstall then
  begin
    Params := '/D /C ""' + ExpandConstant('{app}\install-agent.bat') + '"';
    if WizardIsComponentSelected('pcvision') then
      Params := Params + ' --pc-vision';
    Params := Params + '"';

    if not Exec(ExpandConstant('{sys}\cmd.exe'), Params, ExpandConstant('{app}'),
      SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode) then
    begin
      MsgBox('The setup commands could not be started. Open the installed PromptPilotAgent folder and run install-agent.bat.', mbError, MB_OK);
    end
    else if ResultCode <> 0 then
    begin
      MsgBox('PromptPilot files were copied, but dependency/model setup did not finish successfully. Resolve the error shown in the command window and rerun install-agent.bat from the PromptPilotAgent folder.', mbError, MB_OK);
    end;
  end;
end;
