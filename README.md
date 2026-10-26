# Mini-PC — PromptPilot

A free, local-first dashboard for an in-app browser and supervised desktop PC control.

- **Dashboard:** https://inapp-pc.vercel.app
- **Windows installer status:** The installer wizard builds successfully, but the current published EXE is not Authenticode-signed yet. The release workflow will publish a replacement only after trusted signing and signature verification. See [Windows Authenticode signing](docs/CODE-SIGNING.md).
- **Source code:** https://github.com/Rohit-Singh-1991/Mini-PC

The Windows installer opens a setup wizard and runs the installation commands from `installer/install-agent.bat`. It checks for Node.js 22+ and Ollama, attempts to install missing prerequisites with Windows Package Manager (winget), installs the Node dependencies and Playwright Chromium, then downloads the local `qwen2.5:3b` model. The full-install option also downloads `llava:7b` for screenshot-based PC control; that model is several gigabytes. A Browser-only setup can skip it.

After installation, open **Start PromptPilot Agent** from the Start Menu and copy the bearer token shown in the terminal. Open **Start PromptPilot Tunnel** in a second window, copy the temporary HTTPS `trycloudflare.com` URL, and connect both values at the dashboard's Connection & setup page. Keep both windows open while using the service.

## What it does

- Uses Playwright with local Chromium for browser navigation and page interaction.
- Uses Ollama running on your PC for prompt-driven planning; no hosted AI API is required.
- Provides optional desktop screenshot/mouse/keyboard control after explicit permission.
- Includes an experimental bearer-token authenticated MCP bridge for compatible clients.
- Blocks private/local network destinations, rechecks browser subrequests, redirects and WebSockets, redacts credential-like URL parameters, and pauses potentially consequential browser/desktop actions for explicit approval.

## Local checks

From the repository root:

```bash
npm run build
node --check agent/agent.mjs
npm install --prefix agent
npm run test:smoke --prefix agent
```

The smoke suite uses mock Ollama and a real Playwright Chromium session. It does not prove your own computer is connected; that requires connecting the local agent and tunnel.

## Security and limitations

The dashboard is hosted, but browser automation, Ollama, screenshots, and desktop actions execute on your PC. This is not a permanent cloud PC. Keep the runner and tunnel open only while using them; the temporary tunnel URL and bearer token are secrets. Start with harmless public websites and actively supervise PC control. Do not leave banking, password-manager, or private messaging screens unattended. Passwords, OTPs, CAPTCHAs and recovery/payment codes remain manual-only.

See [agent/README.md](agent/README.md) for detailed setup, MCP bridge, smoke-test, and troubleshooting instructions.

## Code signing policy

**Current status: the published Windows installer is unsigned.** The installer must not be described as Authenticode-signed until the release pipeline verifies a valid signature and trusted timestamp. SignPath Foundation approval and configuration are still pending; the current release is not signed.

Only after approval, the planned attribution is: “Free code signing provided by SignPath.io, certificate by SignPath Foundation”. The repository owner is the committer, reviewer and signing approver for this solo-maintained project; each release-signing request will be manually reviewed. See the [full code signing policy](code-signing.html) and [SignPath setup guide](docs/CODE-SIGNING.md).

Privacy statement: This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. Browser automation and desktop actions run locally, with a tunnel used only when the user explicitly connects the dashboard.
