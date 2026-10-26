# PromptPilot Local Agent

**Live dashboard:** https://inapp-pc.vercel.app

The dashboard is deployed. If you are on mobile, you can review the interface, but installing the local runner, starting Ollama, opening Chromium, and connecting a tunnel still require your Windows/macOS/Linux computer. To set up from source, download the agent files from the [PromptPilot agent folder in GitHub](https://github.com/Rohit-Singh-1991/Mini-PC/tree/main/agent), save them in one folder, inspect `install.ps1`, and run it from PowerShell.

The dashboard is hosted in the cloud. Ollama, Chromium/Playwright and desktop controls run on your PC to avoid paid AI APIs and hosted-browser minutes. This is not a permanent cloud virtual PC.

Requirements: Node.js 22+, Ollama (https://ollama.com/download), and a desktop computer. Optional for remote dashboard access: Cloudflare Tunnel Quick Tunnel, which needs no account or domain.

## Windows (recommended: setup wizard)

1. Review the current [Windows Authenticode signing status](../docs/CODE-SIGNING.md). The installer wizard builds, but the existing public EXE is not yet Authenticode-signed. Do not treat it as signed; a new downloadable release will be published after trusted signing is approved and verified.
2. Choose **Full install** for browser automation plus PC control, or **Browser automation only** if you do not want the extra vision model. Full install downloads `llava:7b`, which is several gigabytes.
3. The installer runs `installer/install-agent.bat`. The batch script checks for Node.js 22+ and Ollama, attempts to install missing prerequisites with Windows Package Manager (winget), installs npm dependencies and Playwright Chromium, starts/checks Ollama, and pulls `qwen2.5:3b` plus the optional PC vision model. If winget installation is unavailable, install Node.js from https://nodejs.org/ and Ollama from https://ollama.com/download, then rerun the batch script in the installed `PromptPilotAgent` folder.
4. Open **Start PromptPilot Agent** from the Start Menu. Keep the terminal open and copy the bearer token it prints.
5. Open **Start PromptPilot Tunnel** in a second window. Copy the temporary HTTPS `trycloudflare.com` URL printed there.
6. Open [the PromptPilot dashboard](https://inapp-pc.vercel.app), open **Connection & setup**, and enter the tunnel URL and bearer token. Save & connect.

The batch script shows its commands and their output in a terminal. The tunnel URL changes when a new Quick Tunnel starts. Keep both terminal windows open while using PromptPilot and stop them afterward.

## macOS / Linux

Download the agent files, then run:
- `npm install`
- `npx playwright install chromium`
- `ollama pull qwen2.5:3b`
- `npm start`

For PC vision, also run `ollama pull llava:7b` (several GB).

## Connect the hosted dashboard

1. Install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. In a second terminal run `cloudflared tunnel --url http://localhost:3920`.
3. Copy the temporary HTTPS `trycloudflare.com` URL, open Connection & setup, and enter that URL plus the agent bearer token.
4. Keep both terminals open. Stop the agent/tunnel after use.

Quick Tunnel URLs are temporary. The URL is public; the bearer token is required for each API request. Never share either.

## Optional: MCP bridge for a compatible client

The experimental MCP bridge exposes a small set of authenticated tools so a compatible MCP client can use this PC's local PromptPilot browser. It is not a cloud PC.

**Important ChatGPT limitation:** OpenAI's current help documentation says custom MCP apps are configured through ChatGPT on the web, not the mobile app. Availability also depends on plan and workspace permissions; full MCP support is currently aimed at Business and Enterprise/Edu, while Pro has limited read/fetch access. Do not assume this bridge can be added to the ChatGPT Go mobile app. If custom MCP connections are unavailable to your account, use the PromptPilot dashboard from your phone instead. See https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt.

1. Start the local agent first in terminal 1 with `npm start`. Keep it running.
2. In terminal 2, from the same agent folder, run `npm run start:mcp`. It listens on `127.0.0.1:3921` and reuses the agent's bearer token.
3. In terminal 3, run `cloudflared tunnel --url http://localhost:3921`.
4. In a compatible MCP client, configure the remote MCP URL as `https://YOUR-TEMPORARY-HOST.trycloudflare.com/mcp` and use bearer-token authentication with the same token printed by the local agent. Never publish the token or tunnel URL.
5. If the client cannot configure custom remote MCP servers, continue using the hosted PromptPilot dashboard instead.

Available tools include browser snapshot, public-site navigation, browser screenshot, a short local-Ollama browser task (up to four steps), stop, explicit desktop-control authorization, desktop screenshot, a short supervised local-Ollama PC task (up to four steps), and PC-control revocation. There is no shell-command tool. PC tasks must be explicitly confirmed per invocation. Every desktop click, key press and typing action pauses for approval in the dashboard. Approve within 90 seconds; pending approvals expire and PC permission is revoked. The MCP bridge revokes one-shot PC permission when the task completes or is rejected. Desktop screenshots may contain private information. This bridge is experimental and must be tested with harmless tasks first.

## Verify the local agent

Run `npm run check` and `npm run test:smoke` from the agent folder. The smoke suite also covers IPv4/IPv6 special-use ranges, mapped IPv4 addresses, embedded URL credentials and approval-policy cases. The smoke test uses a mock Ollama server and a real Playwright Chromium session to verify health/model discovery, bearer-token authentication, private-network URL blocking, navigation, screenshot generation, page title and visible text, and Ollama HTTP-error diagnostics. This does not replace a test with your installed Ollama model or prove that your PC is connected to the hosted dashboard.

Check JavaScript syntax with `npm run check`.

## Browser mode

Write a prompt such as "Open https://example.com and summarize the page". Ollama plans one action at a time, Playwright performs it, and the screenshot appears in the dashboard. Private/local IP destinations are blocked. Passwords, OTPs, CAPTCHA, recovery/payment codes are manual only. Browser buttons, form controls, ambiguous links, and risky destinations pause for approval before execution. Approval resumes the remaining task steps. Pending approvals expire after 90 seconds; reject or stop the task when the action is not appropriate. Verify the result on the actual website.

## PC mode

Select PC control, tick the explicit permission, and actively supervise. The local vision model may ask for mouse clicks, typing or allowlisted keys. Native desktop control can affect any visible app. Never leave sensitive accounts unattended; macOS may require Accessibility and Screen Recording permissions.

## Privacy and troubleshooting

- AI runs through local Ollama; no hosted AI API is used.
- Prompt/action logs do not store typed field values.
- The tunnel forwards to your PC; anyone with both its URL and bearer token could use the exposed capabilities. Do not put the token in screenshots, public prompts, source code or shared logs.
- The runner checks every browser request and redirect against public-IP rules. This reduces SSRF risk but is not a substitute for supervising the session or keeping software updated.
- To revoke, stop the tunnel and agent. Delete `.promptpilot-token` to rotate the local token.
- If model is missing run `ollama pull qwen2.5:3b`; for PC mode run `ollama pull llava:7b`.
- If Chromium is missing run `npx playwright install chromium`.
- For a hosted dashboard use the HTTPS tunnel URL, not `http://127.0.0.1`.
