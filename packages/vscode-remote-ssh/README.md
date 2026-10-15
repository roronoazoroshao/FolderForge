# FolderForge Verified Remote-SSH for VS Code

Open an authenticated FolderForge owner session from an existing **VS Code Desktop Remote-SSH** workspace. No terminal approval command is needed.

## How it works

1. Install this extension **locally** in VS Code (Local — Installed), not on your VPS.
2. Install the FolderForge CLI on your **local** macOS/Linux computer and on the SSH host. The host must already be running FolderForge Mission Control on loopback (default port 7332).
3. Connect your VPS normally with VS Code Remote-SSH and keep your workspace open. Existing VS Code **PORTS forwarding** still works for ordinary browsing.
4. Click **Verify in VS Code** in Mission Control (Fleet / Configure), or run the **FolderForge: Open Verified Mission Control (Remote-SSH)** command in VS Code.
5. Confirm the **actual SSH alias shown by VS Code**. The extension starts `folderforge dashboard ssh --host <your-current-ssh-alias>` on your local machine with `shell:false`. FolderForge verifies the OS UID and live SSH channel, then opens a **separate authenticated** Mission Control browser tab where **Allow AI access** works.

This integration uses an additional verified SSH helper channel, not the existing VS Code TCP forward as authentication. The older forwarded tab cannot become privileged merely because it uses localhost. Closing VS Code or the verified session revokes the corresponding lease.

If you use a custom remote dashboard port, adjust the **FolderForge Remote-SSH: Dashboard Port** VS Code setting. The extension currently supports VS Code Desktop on **macOS and Linux**; Windows fails closed (the upstream SSH launcher does not yet support native Windows). Browser-based VS Code, Dev Containers, WSL and mixed remote SSH workspace authorities do not automatically grant host access.

### Package and install

From the project root:

```bash
cd packages/vscode-remote-ssh
npx --yes --package=@vscode/vsce@4.0.0 vsce package --no-dependencies
code --install-extension folderforge-remote-ssh-0.1.0.vsix --force
```

Alternatively, install the **.vsix** file from the `VS Code Remote-SSH verified handoff` GitHub Actions artifact using **Extensions → ... → Install from VSIX...**. This is a VSIX artifact, **not a Marketplace-published extension**.

To install the FolderForge CLI on your local computer, use the published `@musashishao/folderforge` npm package. If the executable is not on VS Code's local PATH, configure **FolderForge Remote-SSH: Executable Path** (must refer to a trusted installed program). Never bypass SSH host-key verification.

### Security boundaries

- A `vscode://` URI contains no requested host, port, command or credential. The extension rejects query strings/fragments and uses the active VS Code Remote-SSH workspace to select an alias.
- The extension requires explicit confirmation before launching SSH even when invoked by an external website.
- A random forwarded browser tab, spoofed HTTP Host/Origin header or remote web page **never** gains operator capability from this link.
- The original FolderForge SSH helper requires strict host-key checking, a matching remote OS UID and a live, revocable channel.
- Browser pairing tokens and SSH private keys are not passed via deep links or shell interpolation.
- Requires a trusted local CLI and an installed VSIX once; this is not an invisible browser-only enrollment flow.
- If the remote Mission Control requires Dashboard bearer auth, the existing CLI's browser handoff still needs additional support; do not disable authentication to work around this.

The extension does not independently certify installed production environments or allow a remote host to assume OS-owner privileges.
