# PromptPilot Windows Code Signing Policy

## Current release status

**Current published installer: UNSIGNED.** This project has not yet been approved for a SignPath Foundation certificate. A release will be described as Authenticode-signed only after the release workflow verifies a trusted signer certificate, a valid signature, and a timestamp certificate. Do not treat the existing release asset as signed.

The project intends to apply for sponsored open-source signing. **Only after approval**, the planned attribution is: “Free code signing provided by SignPath.io, certificate by SignPath Foundation”. This is a future intent, not a claim that the Foundation has accepted or signed a current release.

## What would be signed

Only the PromptPilot setup executable built from the public [Mini-PC source repository](https://github.com/Rohit-Singh-1991/Mini-PC) by its Windows GitHub Actions workflow is eligible to be submitted for signing. Third-party tools, runtime installers, Node packages, Ollama models, Chromium binaries and cloud services are not signed by this project. The installed agent and dependencies run locally; dashboard/tunnel connectivity is only used when a user explicitly connects the dashboard to a local agent.

## Team roles

This is currently a solo-maintained repository.

- **Committer and maintainer:** [Rohit-Singh-1991](https://github.com/Rohit-Singh-1991), the public repository owner.
- **Reviewer:** the maintainer reviews proposed changes before merging. Contributions from others should use pull requests and must be reviewed before merge.
- **Signing approver:** the maintainer must manually review every release-signing request before approval.

The repository owner must enable and maintain multi-factor authentication for GitHub and SignPath accounts, and keep the source code, build scripts, and workflows open for review.

## Privacy statement

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. Browser automation, prompt planning and desktop actions run on the user's computer. The local agent can connect to the hosted dashboard only after the user starts a temporary tunnel and supplies its URL and local bearer token. Installation downloads third-party software and models from their respective publishers. See the [agent setup guide](../agent/README.md) and their policies: [Ollama](https://ollama.com/legal), [Cloudflare](https://www.cloudflare.com/privacypolicy/), [npm](https://docs.npmjs.com/policies/privacy).

## Installation and uninstallation

The Windows installer offers browser-only or full PC-vision installation. To uninstall, use **Windows Settings → Apps → Installed apps → PromptPilot Local Agent → Uninstall**. The uninstaller removes the PromptPilot installation folder and shortcuts; it does not uninstall independently installed Node.js, Ollama, Cloudflare Tunnel, or remove downloaded Ollama models. These may be removed separately by the user.

## Signature verification

After a future signed release is available, verify the downloaded installer in PowerShell:

```powershell
Get-AuthenticodeSignature .\PromptPilotSetup.exe |
  Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate
Get-FileHash .\PromptPilotSetup.exe -Algorithm SHA256
```

A valid signature and trusted timestamp are required before a release workflow can publish the signed asset. A valid signature establishes the signer's identity and file integrity; it does not guarantee immediate SmartScreen reputation for a newly signed publisher.

## How sponsored signing is being prepared

The public repository uses GPL-3.0 and the release pipeline builds on GitHub-hosted Windows runners. SignPath Foundation approval is not automatic. After the repository owner is accepted, the owner must configure a SignPath organization, GitHub trusted build system, project, Authenticode artifact configuration, and a release-signing policy. The owner must set GitHub Actions secret `SIGNPATH_API_TOKEN` and repository variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, and `SIGNPATH_SIGNING_POLICY_SLUG`. The workflow then signs, verifies, and publishes only the signed result.
