@echo off
setlocal EnableExtensions
title PromptPilot Local Agent
set "PATH=%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%LOCALAPPDATA%\Programs\Ollama;%ProgramFiles%\Ollama;%PATH%"
cd /d "%~dp0"

echo Starting PromptPilot local agent...
echo Keep this terminal open while using the dashboard.
echo Copy the bearer token printed below into Connection ^& setup.
echo.
call npm start
echo.
echo PromptPilot agent stopped.
pause
