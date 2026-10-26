@echo off
setlocal EnableExtensions
title PromptPilot Agent Installer

set "INSTALL_DIR=%~dp0"
set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%LOCALAPPDATA%\Programs\Ollama;%ProgramFiles%\Ollama;%PATH%"
cd /d "%INSTALL_DIR%"

echo.
echo ============================================================
echo   PromptPilot - installing local browser and PC-control agent
echo ============================================================
echo.
echo This installer will install dependencies and download local AI models.
echo Model downloads may take time and use several gigabytes of disk space.
echo.

where winget >nul 2>&1
if errorlevel 1 (set "HAS_WINGET=0") else (set "HAS_WINGET=1")

call :ensure_node
if errorlevel 1 goto failed

call :ensure_ollama
if errorlevel 1 goto failed

echo.
echo [1/4] Installing agent dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto failed

echo.
echo [2/4] Installing Playwright Chromium...
call npx --yes playwright install chromium
if errorlevel 1 goto failed

echo.
echo [3/4] Starting/checking the local Ollama service...
ollama list >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe" (
    echo Starting the Ollama desktop app...
    start "" "%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"
  ) else (
    echo Starting the Ollama service...
    start "PromptPilot Ollama service" /min cmd /c "ollama serve"
  )
)
call :wait_for_ollama
if errorlevel 1 (
  echo ERROR: Ollama did not become available on this PC.
  echo Open Ollama from the Start menu, then rerun install-agent.bat.
  goto failed
)

echo.
echo [4/4] Downloading the local browser-planning model qwen2.5:3b...
call ollama pull qwen2.5:3b
if errorlevel 1 goto failed

if /I "%~1"=="--pc-vision" (
  echo.
  echo Downloading llava:7b for desktop screenshot understanding.
  echo This model is several gigabytes and may take a while.
  call ollama pull llava:7b
  if errorlevel 1 goto failed
) else (
  echo.
  echo PC vision model was not selected. Browser automation is installed.
  echo To enable screenshot-based PC control later, run: ollama pull llava:7b
)

echo.
echo Checking optional Cloudflare Tunnel installation...
where cloudflared >nul 2>&1
if errorlevel 1 (
  if "%HAS_WINGET%"=="1" (
    echo Attempting to install Cloudflare Tunnel for secure dashboard connection...
    winget install --id Cloudflare.cloudflared --exact --accept-package-agreements --accept-source-agreements --silent
    if errorlevel 1 (
      echo WARNING: cloudflared could not be installed automatically.
      echo Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    ) else (
      echo Cloudflare Tunnel installation requested. Open a new terminal if the command is not found yet.
    )
  ) else (
    echo WARNING: winget is not available, so cloudflared was not installed.
    echo Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  )
)

echo.
echo ============================================================
echo   PromptPilot agent setup completed successfully.
echo ============================================================
echo.
echo Next steps:
echo 1. Use the Start Menu shortcut "Start PromptPilot Agent".
echo 2. Copy the bearer token printed in its terminal.
echo 3. Use "Start PromptPilot Tunnel" in a second terminal/window.
echo 4. Paste the tunnel HTTPS URL and token at https://inapp-pc.vercel.app
echo.
pause
exit /b 0

:ensure_node
node -e "process.exit(Number(process.versions.node.split('.')[0])>=22?0:1)" >nul 2>&1
if not errorlevel 1 exit /b 0
echo Node.js 22 or newer was not found. Attempting to install the current LTS...
if "%HAS_WINGET%"=="0" (
  echo ERROR: winget is unavailable. Install Node.js 22+ from https://nodejs.org/ and rerun setup.
  exit /b 1
)
winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%PATH%"
node -e "process.exit(Number(process.versions.node.split('.')[0])>=22?0:1)" >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js 22+ is still unavailable. Open a new terminal or install it from https://nodejs.org/.
  exit /b 1
)
exit /b 0

:ensure_ollama
where ollama >nul 2>&1
if not errorlevel 1 exit /b 0
echo Ollama was not found. Attempting to install it...
if "%HAS_WINGET%"=="0" (
  echo ERROR: winget is unavailable. Install Ollama from https://ollama.com/download and rerun setup.
  exit /b 1
)
winget install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements --silent
set "PATH=%LOCALAPPDATA%\Programs\Ollama;%ProgramFiles%\Ollama;%PATH%"
where ollama >nul 2>&1
if errorlevel 1 (
  echo ERROR: Ollama is still unavailable. Install it from https://ollama.com/download and rerun setup.
  exit /b 1
)
exit /b 0

:wait_for_ollama
for /l %%I in (1,1,45) do (
  ollama list >nul 2>&1
  if not errorlevel 1 exit /b 0
  timeout /t 2 /nobreak >nul
)
exit /b 1

:failed
echo.
echo INSTALLATION DID NOT COMPLETE.
echo Read the error above, resolve it, then rerun setup from the installed folder:
echo %INSTALL_DIR%install-agent.bat
echo.
pause
exit /b 1
