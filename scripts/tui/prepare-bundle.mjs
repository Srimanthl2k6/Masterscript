import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

mkdirSync('tui/dist', { recursive: true })
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const cargo = process.env.MASTERSCRIPT_CARGO_TOOLCHAIN ? [`+${process.env.MASTERSCRIPT_CARGO_TOOLCHAIN}`] : []
const executable = process.platform === 'win32' ? 'masterscript-tui.exe' : 'masterscript-tui'
if (process.platform === 'darwin') {
  for (const target of ['aarch64-apple-darwin', 'x86_64-apple-darwin']) {
    run('cargo', [...cargo, 'build', '--locked', '--release', '--manifest-path', 'tui/Cargo.toml', '--target', target])
  }
  run('lipo', ['-create', 'tui/target/aarch64-apple-darwin/release/masterscript-tui', 'tui/target/x86_64-apple-darwin/release/masterscript-tui', '-output', 'tui/dist/masterscript-tui'])
} else {
  run('cargo', [...cargo, 'build', '--locked', '--release', '--manifest-path', 'tui/Cargo.toml'])
  copyFileSync(join('tui/target/release', executable), join('tui/dist', executable))
}
const config = JSON.parse(readFileSync('src-tauri/tauri.ci.conf.json', 'utf8'))
config.bundle.resources = { [`../tui/dist/${executable}`]: executable }
if (process.platform === 'linux') config.bundle.linux = { deb: { files: { '/usr/bin/masterscript-tui': '../tui/dist/masterscript-tui' } }, rpm: { files: { '/usr/bin/masterscript-tui': '../tui/dist/masterscript-tui' } } }
writeFileSync('src-tauri/tauri.release.conf.json', JSON.stringify(config, null, 2) + '\n')
