$ErrorActionPreference = "Stop"
$Base = "https://inapp-pc.vercel.app/agent"
$Source = $PSScriptRoot
$Folder = Join-Path $HOME "PromptPilotAgent"
New-Item -ItemType Directory -Force -Path $Folder | Out-Null
Set-Location $Folder
Write-Host "Setting up PromptPilot Local Agent in $Folder" -ForegroundColor Cyan

# Prefer files downloaded together from the private GitHub repository. This also works
# before the dashboard's first deployment. Only fall back to the hosted downloads when
# the local source files are missing.
foreach ($File in @("agent.mjs", "package.json", "README.md")) {
  $LocalFile = Join-Path $Source $File
  if (Test-Path $LocalFile) {
    Copy-Item $LocalFile (Join-Path $Folder $File) -Force
  } else {
    try {
      Invoke-WebRequest "$Base/$File" -OutFile $File
    } catch {
      throw "Could not fetch $File from the dashboard. Download agent.mjs, package.json, README.md and install.ps1 from the PromptPilot agent folder in GitHub, keep them together, and run install.ps1 again."
    }
  }
}

Write-Host "Installing Node dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed. Install Node.js 22+ and retry." }
Write-Host "Installing Chromium..." -ForegroundColor Cyan
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Chromium installation failed." }
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Write-Host "Downloading local model qwen2.5:3b..." -ForegroundColor Cyan
  ollama pull qwen2.5:3b
} else {
  Write-Warning "Install Ollama from https://ollama.com/download; then run ollama pull qwen2.5:3b."
}
Write-Host "Setup complete. Run npm start in this folder." -ForegroundColor Green
Write-Host "In a second terminal run: cloudflared tunnel --url http://localhost:3920" -ForegroundColor Yellow
