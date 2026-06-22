# MasterScript Threat Model

## Assets

- Screenplays, notes, character data, revision history, and recent-project metadata.
- Local file grants and canonical project paths.
- LAN invite secrets and encrypted collaboration traffic.
- Updater private key, release artifacts, and update metadata.
- Legacy migration manifests and autosaves.

## Trust boundaries

### Webview and Rust IPC

The React webview is less trusted than the Rust process. Only explicitly registered Tauri commands are exposed. Project files are addressed through opaque Rust-issued grants; canonical paths do not cross into the webview.

### Imported documents

FDX, Fountain, DOCX, and project JSON are untrusted. Size, archive expansion, entry-count, structure, timeout, generated-text, block-count, and schema limits are enforced before imported data can replace the active project.

### LAN collaboration

LAN peers and local network traffic are untrusted. Protocol v2 uses random room identifiers and invite secrets, HKDF-separated keys, HMAC challenge/response, AES-256-GCM authenticated data, replay controls, bounded peers and queues, timeouts, source-address restrictions, and rate limits.

Project files and recovered state are also untrusted connection instructions. MasterScript reconnects only when the exact collaboration target matches a local fingerprint created by an explicit host or join action. Remote project state is structurally validated before it reaches the active project or persistence.

### Website

The browser-hosted application stores local screenplay state in browser storage. A restrictive response-header CSP limits scripts, connections, images, frames, and embedding; additional response headers isolate opener state, block MIME sniffing, restrict browser features, and require HTTPS. The website does not receive desktop capabilities or automatic first-run onboarding.

### Persistence and migration

Application data is local to the current OS user. Atomic writes reduce corruption risk but do not defend against a malicious process running as the same user. Legacy imports are restricted to canonical MasterScript directories and exact expected filenames, and never overwrite valid Tauri state.

### Updater and release pipeline

Unsigned builders execute repository code without production signing secrets. A protected signing environment downloads only checksummed artifacts, verifies them, uses a checksum-pinned Tauri signer, and exposes the private key only to signing commands. The app accepts HTTPS update metadata and requires Tauri signatures.

## Principal threats and controls

| Threat | Primary controls | Residual risk |
| --- | --- | --- |
| Malicious imported archive or parser denial of service | Rust prevalidation, bounded worker, timeouts, output limits | Novel parser vulnerabilities in third-party libraries |
| Webview compromise reaching arbitrary files | CSP, local fonts, narrow capabilities, explicit commands, opaque grants | A permitted command may still contain a logic flaw |
| Unauthorized collaboration or flooding | Explicit local trust, authenticated LAN protocol v2, encryption, replay/rate/queue limits, remote-state validation | Host OS or same-user malware can observe process memory |
| Browser injection or hostile embedding | Production CSP, local fonts, defensive response headers, no desktop IPC | Browser extensions or a compromised same-origin deployment remain trusted by the browser |
| Corrupt or hostile migration state | Canonical-root checks, schema/size validation, no overwrite | Legacy data may be skipped and require manual recovery |
| Supply-chain compromise | Lockfiles, audits, Dependabot, SHA-pinned actions, SBOM, artifact digests | Registry or toolchain compromise outside project control |
| Malicious update | Isolated signing, signatures, HTTPS endpoint, protected environment | Private-key compromise requires emergency key response |
| Local screenplay theft | OS user permissions and optional full-disk encryption | Project files are not application-level encrypted at rest |

## Same-user boundary

MasterScript is a current-user desktop application. It does not claim to isolate data from other processes running with the same OS user privileges. Windows `currentUser` installation and passive updates remain intentional.

## Review triggers

Update this model when adding a new import format, network destination, Tauri plugin or command, collaboration protocol, persistence location, updater key, installer target, or privileged CI credential.
