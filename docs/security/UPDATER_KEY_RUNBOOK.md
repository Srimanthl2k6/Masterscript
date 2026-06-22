# Updater Signing Key Runbook

## Normal handling

- Keep the production Tauri private key only in the protected `release-signing` GitHub environment.
- Maintain an encrypted offline backup and verify recovery access at least twice per year.
- Never expose the key to checkout, dependency installation, tests, application builds, logs, or artifacts.
- Restrict use to the individual `cargo-tauri signer sign` commands after digest verification.

## Planned rotation

1. Generate the replacement key offline and back it up.
2. Add the new public key to an application release that is still signed by the old private key.
3. Publish that old-key-signed transition release and allow a documented adoption window.
4. Move the signing environment to the replacement private key.
5. Publish and verify a release signed by the replacement key.
6. Revoke access to the old key but retain an encrypted archival copy until the transition window closes.

This old-key-signed transition release is mandatory because installed clients trust the public key embedded in their current binary.

## Suspected compromise

1. Freeze the release workflow and disable the update endpoint immediately.
2. Preserve workflow, environment, audit, release, and access logs.
3. Rotate repository and environment credentials.
4. Determine the first potentially exposed artifact and notify users.
5. Do not sign a transition release with a key known to be compromised.
6. Publish clean installers through authenticated HTTPS channels and require a manual reinstall with a newly embedded public key.
7. Restore automatic updates only after independent verification of the new pipeline and key custody.

## Lost key

If the private key is lost but not compromised, existing installations cannot trust a newly signed updater. Publish new installers and clear manual-reinstall instructions; do not weaken or disable signature verification.

