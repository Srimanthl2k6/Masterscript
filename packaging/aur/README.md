`masterscript-bin` is prepared from each release's actual Arch archive by
`node scripts/release/generate-aur.mjs VERSION ARCHIVE OUTPUT`.
The release contains its exact `PKGBUILD` and `.SRCINFO`, including a real SHA-256.
Never substitute `SKIP` for a release checksum.

The `Publish AUR package` workflow requires `AUR_SSH_PRIVATE_KEY` for an account
authorized to push `masterscript-bin`, plus `AUR_KNOWN_HOSTS` containing the
independently verified aur.archlinux.org SSH host key, in `aur-publishing`.
Until publication is verified, `release-assets.json` keeps `aurPublished: false`.
The direct `.pkg.tar.zst` release download remains available independently.

Validate in Arch with `makepkg --verifysource`, `makepkg --printsrcinfo`,
`makepkg --nodeps`, and `namcap`. The release workflow also inspects the binary
archive and verifies that both GUI and terminal executables are present.
