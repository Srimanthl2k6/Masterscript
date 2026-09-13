import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
const [version, archive, output = 'packaging/aur'] = process.argv.slice(2)
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !archive) throw new Error('Usage: generate-aur.mjs VERSION ARCH_PACKAGE OUTPUT')
const hash = createHash('sha256').update(readFileSync(archive)).digest('hex')
const filename = basename(archive)
if (filename !== `MasterScript.linux.${version}.x86_64.pkg.tar.zst`) throw new Error('Unexpected Arch archive name')
const url = `https://github.com/Srimanthl2k6/Masterscript/releases/download/v${version}/${filename}`
const dependencies = ['webkit2gtk-4.1', 'gtk3', 'libayatana-appindicator', 'openssl', 'gcc-libs', 'glibc']
const pkgbuild = `# Generated from the verified release archive. Do not replace checksums with SKIP.
pkgname=masterscript-bin
pkgver=${version}
pkgrel=1
pkgdesc='MasterScript screenplay editor and terminal UI'
arch=('x86_64')
url='https://github.com/Srimanthl2k6/Masterscript'
license=('custom')
depends=(${dependencies.map(value => `'${value}'`).join(' ')})
provides=('masterscript' 'masterscript-tui')
conflicts=('masterscript')
options=('!strip')
source=('${url}')
sha256sums=('${hash}')

package() {
  cp -a "$srcdir/usr" "$pkgdir/"
}
`
const srcinfo = `pkgbase = masterscript-bin
\tpkgdesc = MasterScript screenplay editor and terminal UI
\tpkgver = ${version}
\tpkgrel = 1
\turl = https://github.com/Srimanthl2k6/Masterscript
\tarch = x86_64
\tlicense = custom
${dependencies.map(value => `\tdepends = ${value}`).join('\n')}
\tprovides = masterscript
\tprovides = masterscript-tui
\tconflicts = masterscript
\toptions = !strip
\tsource = ${url}
\tsha256sums = ${hash}

pkgname = masterscript-bin
`
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'PKGBUILD'), pkgbuild)
writeFileSync(join(output, '.SRCINFO'), srcinfo)
console.log(`Generated masterscript-bin ${version} with SHA-256 ${hash}`)
