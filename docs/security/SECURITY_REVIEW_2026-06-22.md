# MasterScript Security Review — 2026-06-22

## Executive summary

This review covered the 215-file application, Rust desktop boundary, collaboration
protocols, website, persistence and migration code, imports and exports, GitHub
Actions, updater, packaging, and repository settings.

All high- and medium-severity findings identified in this review have been
remediated in the release candidate. The remaining items are documented residual
risks or operational controls rather than unresolved confirmed vulnerabilities.

The review used:

- manual source-to-sink analysis of TypeScript, React, Rust, workflow, installer,
  and deployment files;
- focused adversarial tests for collaboration, import, migration, file grants,
  tutorial behavior, website headers, updater boundaries, and export limits;
- dependency advisory checks for npm and Rust;
- literal-secret and dangerous-API searches;
- full JavaScript tests, lint, TypeScript compilation, and production web build;
- cross-platform Rust and installer validation in GitHub Actions.

## Findings and remediation order

### MS-2026-01 — Embedded collaboration metadata could disclose screenplay state

- **Severity:** High
- **Status:** Fixed
- **Affected boundary:** Project open, autosave recovery, and recent-project
  recovery into WebRTC or LAN collaboration.
- **Risk:** A hostile project file containing collaboration metadata could cause
  an automatic connection. The holder of the embedded invite could then receive
  later screenplay state without a fresh local decision.
- **Fix:** Automatic reconnection now requires a local trust record created only
  after an explicit host or join action. The record contains a SHA-256
  fingerprint, not the invite secret. Untrusted embedded metadata remains inert.
- **Verification:** Trusted-collaboration unit tests and application wiring
  regression tests cover matching, changed, malformed, and absent trust records.

### MS-2026-02 — Production website lacked an enforced security policy

- **Severity:** Medium
- **Status:** Fixed
- **Affected boundary:** Browser-hosted MasterScript.
- **Risk:** Browser storage contains screenplay data. Without CSP and defensive
  response headers, a future injection defect would have a larger impact.
- **Fix:** Production Vite output receives a restrictive CSP. Vercel also emits
  CSP, clickjacking, MIME-sniffing, referrer, permissions, opener, resource, and
  transport-security headers. Fonts are bundled locally.
- **Verification:** Static regression tests inspect both generated policy and
  deployment headers; the production web build succeeds.

### MS-2026-03 — Export IPC accepted unbounded text and base64 payloads

- **Severity:** Medium
- **Status:** Fixed
- **Affected boundary:** Webview-to-Rust export commands.
- **Risk:** A compromised renderer could force large allocations before the save
  dialog or file write, causing memory exhaustion.
- **Fix:** Rust rejects text over 20 MiB, encoded payloads above their computed
  base64 ceiling, and decoded binary output over 100 MiB before writing.
- **Verification:** Rust unit tests and static IPC boundary tests cover exact
  limits and oversized input.

### MS-2026-04 — LAN identifiers and client transports were insufficiently bounded

- **Severity:** Medium
- **Status:** Fixed
- **Affected boundary:** Rust LAN host and outbound transport commands.
- **Risk:** Arbitrary room strings and unlimited transport sessions could consume
  memory, tasks, and socket resources through permitted IPC.
- **Fix:** LAN v2 now requires the exact 128-bit room-ID encoding and 256-bit
  invite-secret encoding. Client transports are capped at eight concurrent
  sessions with semaphore-backed lifetime permits.
- **Verification:** Unit and boundary tests cover malformed IDs, public targets,
  session accounting, and capacity.

### MS-2026-05 — Authenticated peers could amplify synchronization work

- **Severity:** Medium
- **Status:** Fixed
- **Affected boundary:** Encrypted Yjs LAN provider.
- **Risk:** A peer with a valid invite could repeatedly request full state,
  causing avoidable CPU, memory, and network amplification.
- **Fix:** Full synchronization responses are rate-limited. Existing relay
  message, byte, peer, queue, source-address, and handshake limits remain active.
- **Verification:** Provider tests exercise repeated synchronization requests and
  assert bounded responses.

### MS-2026-06 — Invalid remote collaboration state could enter persistence

- **Severity:** Medium
- **Status:** Fixed
- **Affected boundary:** WebRTC and LAN Yjs state conversion.
- **Risk:** An authenticated hostile peer could provide structurally invalid or
  excessive project state, leading to crashes or invalid autosaves.
- **Fix:** Remote state is passed through the shared bounded project validator
  before application or persistence. Invalid state disconnects the session,
  clears its local collaboration cache, and leaves the active project intact.
- **Verification:** Security tests cover malformed and over-limit remote state.

### MS-2026-07 — External links retained an opener relationship

- **Severity:** Low
- **Status:** Fixed
- **Affected boundary:** Advanced tools external navigation.
- **Risk:** An opened page could retain a reference to the MasterScript browser
  window in environments where opener isolation was not otherwise enforced.
- **Fix:** Only HTTPS URLs are accepted, `noopener,noreferrer` is requested, and
  any returned opener reference is cleared. Download links already used the
  equivalent anchor protections.
- **Verification:** Unit tests cover allowed, rejected, and opener-clearing paths.

### MS-2026-08 — Damaged installation state could re-enable onboarding

- **Severity:** Low
- **Status:** Fixed
- **Affected boundary:** Desktop installation classification.
- **Risk:** A missing or corrupt install-state file could classify an existing
  desktop user as fresh and show automatic onboarding after an update.
- **Fix:** Rust now recognizes autosaves, recent snapshots, imported manifests,
  migration reports, and file grants as existing-install evidence. Automatic
  onboarding is also explicitly disabled for the website.
- **Verification:** Migration and tutorial tests cover fresh, migrated, existing,
  corrupt-state, desktop, and web cases.

## Previously planned controls verified in this release

- LAN protocol v2 uses random room identifiers and invite secrets,
  domain-separated HKDF-SHA256 keys, nonce HMAC authentication, constant-time
  proof checks, AES-256-GCM authenticated encryption, replay rejection, private
  source-address checks, handshake timeouts, rate limits, and bounded queues.
- Tauri exposes explicit commands and narrow capability permissions. Project
  paths remain in Rust and the webview uses opaque, persistent file grants.
- FDX and Fountain imports are capped at 10 MiB. DOCX is capped at 25 MiB
  compressed, 100 MiB expanded, 10,000 entries, and a 200:1 expansion ratio.
  Conversion runs in a worker with a 15-second timeout and bounded output.
- Migration accepts only canonical legacy MasterScript locations and exact
  expected filenames, rejects links and malformed or oversized state, and never
  overwrites valid Tauri state.
- Production signing secrets are absent from builders and tests. A protected
  signing job does not check out or execute repository application code, verifies
  artifact digests, uses a checksum-pinned Tauri signer, and scopes the private
  key to individual signing commands.
- Workflow actions are pinned to reviewed full commit SHAs. Dependabot, npm and
  Rust advisory gates, dependency review, CodeQL, SBOM generation, release
  provenance, private vulnerability reporting, branch protection, secret
  scanning, and push protection are enabled.

## Current-practice mapping

| Security practice | MasterScript implementation | Status |
| --- | --- | --- |
| Minimize desktop privilege and IPC authority | Tauri capability allowlist, explicit commands, opaque file grants | Implemented |
| Treat imported documents as hostile | Pre-allocation limits, ZIP validation, worker timeout, structural validation | Implemented |
| Protect local-first document integrity | Atomic writes, bounded schemas, autosave recovery, no migration overwrite | Implemented |
| Require explicit trust before sharing writing data | User-approved collaboration trust record and authenticated invites | Implemented |
| Encrypt network document traffic | AES-256-GCM LAN protocol and encrypted WebRTC application data | Implemented |
| Constrain web content and egress | Desktop and website CSP, local fonts, fixed signaling destination | Implemented |
| Secure software updates | HTTPS metadata, embedded public key, isolated signing, digest verification | Implemented |
| Harden the software supply chain | Lockfiles, audits, SHA-pinned actions, SBOM, provenance, protected release environment | Implemented |
| Provide vulnerability intake and response | Private reporting policy and updater-key incident runbook | Implemented |
| Protect data at rest | OS account permissions and full-disk encryption guidance | Shared responsibility |
| Support recovery from data loss | Autosave, snapshots, portable project files, atomic persistence | Implemented |

The mapping follows the current guidance in:

- [NIST Secure Software Development Framework
  1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [CISA Secure by
  Design](https://www.cisa.gov/sites/default/files/2023-06/principles_approaches_for_security-by-design-default_508c.pdf)
- [Tauri content security
  policy](https://v2.tauri.app/security/csp/)
- [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri updater](https://v2.tauri.app/plugin/updater/)
- [OWASP File Upload Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Content Security Policy Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP HTML5 Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [GitHub dependency
  review](https://docs.github.com/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review)
- [GitHub artifact
  attestations](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds)
- [NIST data-loss
  protection](https://csrc.nist.gov/pubs/other/2020/04/24/protecting-data-from-ransomware-and-other-data-los/final)

## Residual risks and operational requirements

1. **Same-user compromise:** MasterScript does not isolate screenplay data from
   malware already running as the same OS user. Users handling sensitive work
   should enable device encryption, account protection, and reliable backups.
2. **Portable project confidentiality:** Project files are intentionally portable
   and are not encrypted by the application. Adding mandatory application-level
   encryption would require a separate key-management and recovery design and
   could create permanent data-loss failure modes.
3. **Browser storage:** The website stores local project data in browser storage.
   CSP materially reduces injection risk but cannot protect against a compromised
   browser profile, extension, or same-origin deployment.
4. **WebRTC metadata:** Internet collaboration uses a public signaling service and
   may expose connection metadata such as IP addresses to the signaling and peer
   layers. Screenplay synchronization remains encrypted.
5. **Third-party parser risk:** Bounded execution reduces denial-of-service impact
   but cannot eliminate unknown vulnerabilities in document-conversion libraries.
6. **Release operations:** The protected signing environment, reviewer approval,
   offline key backup, and emergency endpoint shutdown procedure must remain
   enforced. A lost updater key requires manual reinstall.

## Verification record

Before publication, the release gate requires:

- full JavaScript unit and regression suite;
- ESLint and TypeScript production build;
- npm and RustSec advisory gates;
- Rust formatting, tests, and compilation on Windows, macOS, and Linux;
- workflow linting, security workflow, CodeQL, and dependency review;
- Tauri installer and updater artifact builds on all target platforms;
- release checksum, signature, alias, performance, and download verification.

Publication is blocked if a confirmed high/critical finding remains, a security
test fails, project data is lost, or the existing visual baselines regress.
