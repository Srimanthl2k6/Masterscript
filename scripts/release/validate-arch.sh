#!/usr/bin/env bash
set -euo pipefail
ASSETS="$(realpath "$1")"
pacman -Syu --noconfirm
pacman -S --needed --noconfirm webkit2gtk-4.1 gtk3 libayatana-appindicator openssl libxdo namcap desktop-file-utils
useradd --create-home builder
install -d -o builder -g builder /home/builder/package
cp "$ASSETS/PKGBUILD" "$ASSETS/.SRCINFO" /home/builder/package/
cp "$ASSETS"/MasterScript.linux.*.x86_64.pkg.tar.zst /home/builder/package/
chown -R builder:builder /home/builder/package
cd /home/builder/package
runuser -u builder -- makepkg --printsrcinfo > actual.SRCINFO
diff -u .SRCINFO actual.SRCINFO
runuser -u builder -- makepkg --verifysource
runuser -u builder -- makepkg --noconfirm
namcap PKGBUILD masterscript-bin-*.pkg.tar.zst
pacman -U --noconfirm masterscript-bin-*.pkg.tar.zst
test "$(masterscript-tui --version)" = "masterscript-tui $(sed -n 's/^pkgver=//p' PKGBUILD)"
test -x /usr/bin/masterscript
desktop-file-validate /usr/share/applications/masterscript.desktop
pacman -Qkk masterscript-bin
pacman -R --noconfirm masterscript-bin
# The direct package must also install with pacman, independently of the AUR recipe.
VERSION="$(sed -n 's/^pkgver=//p' PKGBUILD)"
pacman -U --noconfirm "$ASSETS/MasterScript.linux.$VERSION.x86_64.pkg.tar.zst"
test "$(masterscript-tui --version)" = "masterscript-tui $VERSION"
pacman -Qkk masterscript
