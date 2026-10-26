# Windows Authenticode signing

## Current status

The installer wizard compiles successfully, but the currently published `PromptPilotSetup.exe` asset is **not Authenticode-signed**. Do not describe or distribute that existing asset as signed. The updated release workflow now publishes a new `installer-latest` asset only after a signing service has signed it and Windows verifies both the signature and timestamp.

The workflow is prepared for SignPath. It does not create a fake/self-signed certificate and will not publish a release when SignPath is not configured.

## Recommended no-cost route: SignPath Foundation (approval required)

This repository is public and has a GPL-3.0 license. SignPath Foundation offers code signing for eligible open-source projects, subject to application review and its conditions. If approved, the signing certificate is issued to SignPath Foundation, so Windows will show that publisher rather than DigiCreators. See the [SignPath Foundation terms](https://github.com/SignPath/fdn-website/blob/main/docs/terms.md).

1. Apply at [SignPath Foundation](https://signpath.org/apply). The project application and any terms/identity declarations must be completed by the repository owner. Approval is not automatic.
2. After approval, configure the SignPath organization with the predefined **GitHub.com trusted build system** and link it to this project. Install the SignPath GitHub App for the repository if SignPath requests it.
3. Create a project for `Rohit-Singh-1991/Mini-PC`. Configure an artifact configuration that signs the `PromptPilotSetup.exe` PE file using Authenticode, with SHA-256 and a trusted timestamp. Configure a release-signing policy that uses this certificate and restricts submissions to the `main` branch. Manual approval for release-signing is recommended.
4. Create a SignPath CI user/API token that is permitted to submit to the release-signing policy.
5. In GitHub, open **Settings → Secrets and variables → Actions** for this repository. Add the following secret and repository variables:

   | Name | GitHub entry type | Value |
   | --- | --- | --- |
   | `SIGNPATH_API_TOKEN` | Secret | API token from the authorized SignPath CI user |
   | `SIGNPATH_ORGANIZATION_ID` | Variable | ID shown for the SignPath organization |
   | `SIGNPATH_PROJECT_SLUG` | Variable | Exact project slug configured in SignPath |
   | `SIGNPATH_SIGNING_POLICY_SLUG` | Variable | Exact release-signing policy slug configured in SignPath |

6. After those are configured and approval is complete, push a normal change under `main` or manually run [Build and Authenticode-sign Windows installer](https://github.com/Rohit-Singh-1991/Mini-PC/actions/workflows/windows-installer.yml). The workflow builds the installer, uploads the unsigned candidate privately as a workflow artifact for the signing request, waits for SignPath, verifies the signed result in Windows, checks for a trusted timestamp, and only then publishes the signed installer to the release.

If signing variables/secrets are absent, the workflow can compile an internal candidate but will skip publishing a release asset. Never upload a PFX or private key to the repository or paste it into a chat.

## Verify a published release on Windows

After the signed release is available, download the asset and run in PowerShell:

```powershell
Get-AuthenticodeSignature .\PromptPilotSetup.exe |
  Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate

Get-FileHash .\PromptPilotSetup.exe -Algorithm SHA256
```

Expected signature status is `Valid`, with both a signer certificate and timestamp certificate. A valid Authenticode signature establishes the signer's identity and file integrity; it does not guarantee immediate SmartScreen reputation for a newly signed publisher. SmartScreen warnings can persist until reputation builds.

## If you already own a commercial code-signing certificate

Do not send the private key in this chat. The current automation uses SignPath. The workflow can be adapted to your existing CA-issued certificate after the certificate provider and safe CI signing method are confirmed.
