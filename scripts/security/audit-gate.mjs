import { spawnSync } from 'node:child_process'
import { readValidatedExceptions } from './validate-advisory-exceptions.mjs'

const runJsonCommand = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = result.stdout?.trim()
  if (!output) {
    throw new Error(
      `${command} produced no JSON output: ${result.stderr?.trim() || 'unknown error'}`,
    )
  }
  try {
    return JSON.parse(output)
  } catch {
    throw new Error(
      `${command} returned invalid JSON: ${result.stderr?.trim() || output.slice(0, 500)}`,
    )
  }
}

const advisoryIds = (value) => {
  const matches = JSON.stringify(value).match(
    /\b(?:GHSA-[0-9a-z-]+|RUSTSEC-\d{4}-\d+|CVE-\d{4}-\d+)\b/gi,
  )
  return [...new Set((matches ?? []).map((id) => id.toUpperCase()))]
}

const npmReport = runJsonCommand('npm', ['audit', '--json'])
const npmFindings = Object.entries(npmReport.vulnerabilities ?? {})
  .filter(([, finding]) => ['high', 'critical'].includes(finding.severity))
  .map(([packageName, finding]) => ({
    source: 'npm',
    severity: finding.severity,
    packageName,
    ids: advisoryIds(finding),
  }))

const cargoReport = runJsonCommand('cargo', [
  'audit',
  '--json',
  '--file',
  'src-tauri/Cargo.lock',
])
const cargoFindings = (cargoReport.vulnerabilities?.list ?? []).map(
  (finding) => ({
    source: 'RustSec',
    severity: 'high',
    packageName: finding.package?.name ?? 'unknown crate',
    ids: advisoryIds(finding),
  }),
)
const cargoUnsoundFindings = (cargoReport.warnings?.unsound ?? []).map(
  (finding) => ({
    source: 'RustSec',
    severity: 'unsound',
    packageName: finding.package?.name ?? 'unknown crate',
    ids: advisoryIds(finding),
  }),
)

const exceptions = new Map(
  readValidatedExceptions().map((entry) => [entry.id.toUpperCase(), entry]),
)
const blocked = []

for (const finding of [
  ...npmFindings,
  ...cargoFindings,
  ...cargoUnsoundFindings,
]) {
  const accepted = finding.ids.find((id) => exceptions.has(id))
  if (accepted) {
    const entry = exceptions.get(accepted)
    console.warn(
      `Accepted ${accepted} until ${entry.expires}; owner=${entry.owner}`,
    )
    continue
  }
  blocked.push(finding)
}

if (blocked.length > 0) {
  for (const finding of blocked) {
    console.error(
      `${finding.source} ${finding.severity}: ${finding.packageName} (${finding.ids.join(', ') || 'no advisory ID'})`,
    )
  }
  throw new Error(
    'High/critical dependency advisories require a fix or a valid, expiring exception',
  )
}

console.log('No unexcepted high/critical npm or RustSec advisories found')
