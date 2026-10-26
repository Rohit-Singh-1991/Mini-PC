@echo off
setlocal EnableExtensions
title PromptPilot Secure Dashboard Tunnel
set "PATH=%LOCALAPPDATA%\Microsoft\WinGet\Links;%ProgramFiles%\Cloudflare;%ProgramFiles(x86)%\Cloudflare;%PATH%"
cd /d "%~dp0"

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared was not found.
  echo Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo Then open a new terminal and run this file again.
  pause
  exit /b 1
)

echo Creating a temporary HTTPS tunnel to the local PromptPilot agent...
echo Copy the HTTPS trycloudflare.com URL printed below into the dashboard.
echo Keep this window open while using PromptPilot. Treat the URL as private.
echo.
cloudflared tunnel --url http://localhost:3920
echo.
echo Tunnel stopped.
pause
