# Mini-PC — PromptPilot

A free, local-first dashboard for an in-app browser and supervised desktop PC control.

**Dashboard:** https://inapp-pc.vercel.app

## What it does
- Uses Playwright with local Chromium for browser navigation and page interaction.
- Uses Ollama running on your PC for prompt-driven planning; no hosted AI API is required.
- Provides optional desktop screenshot/mouse/keyboard control after explicit permission.
- Includes a bearer-token authenticated experimental MCP bridge for compatible clients.
- Blocks private/local network destinations, rechecks browser subrequests and redirects, and pauses potentially consequential browser/desktop actions for explicit approval.

## Windows setup
Requirements: Node.js 22+, Ollama, and the Windows PC you want to control.

1. Open the dashboard's Connection & setup page, or download the files from the agent folder in this repository.
2. Inspect agent/install.ps1, then run these commands in PowerShell from the agent folder:

~~~powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
~~~

3. Run npm start and copy the local bearer token printed in the terminal.
4. In a second terminal run cloudflared tunnel --url http://localhost:3920.
5. In the dashboard, enter the temporary HTTPS tunnel URL and bearer token, then connect.

The dashboard is hosted on Vercel, but browser automation, Ollama, screenshots, and desktop actions execute on your PC. This is not a permanent cloud PC. Keep the runner and tunnel open only while using them. Treat both the tunnel URL and token as secrets.

## In-app browser and PC-control behavior
- Browser mode uses Playwright/Chromium to navigate and interact with pages.
- PC mode needs a local vision model such as llava:7b, explicit session authorization, and active supervision.
- Passwords, OTPs, CAPTCHAs and recovery/payment codes are manual-only. Browser form controls and desktop interactions may pause for explicit user approval.
- Never leave banking, password-manager or private messaging screens unattended; test first on harmless public sites.

## Optional MCP bridge
See agent/README.md for setup instructions. The bridge uses bearer-token authentication, has no shell-command tool, and limits PC tasks to short supervised actions. Custom MCP availability depends on the client and account; if ChatGPT mobile cannot configure a custom server, use the dashboard in the mobile browser.

## Development checks
Run from the repository root:

~~~bash
npm run build
node --check agent/agent.mjs
npm install --prefix agent
npm run test:smoke --prefix agent
~~~

The smoke test uses mock Ollama and a real Playwright Chromium session. It does not prove your specific computer is connected; that requires running the local agent and connecting its tunnel.
