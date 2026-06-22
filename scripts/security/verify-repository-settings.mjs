const repository = process.env.GITHUB_REPOSITORY ?? 'Srimanthl2k6/Masterscript'
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN

if (!token) {
  throw new Error('Set GH_TOKEN or GITHUB_TOKEN to verify repository settings')
}

const request = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    throw new Error(`${path}: GitHub returned ${response.status}`)
  }
  return response.json()
}

const [
  protection,
  actionPermissions,
  workflowPermissions,
  signingEnvironment,
  privateReporting,
] = await Promise.all([
  request('/branches/main/protection'),
  request('/actions/permissions'),
  request('/actions/permissions/workflow'),
  request('/environments/release-signing'),
  request('/private-vulnerability-reporting'),
])

const requiredChecks =
  protection.required_status_checks?.contexts ??
  protection.required_status_checks?.checks?.map((check) => check.context) ??
  []
const requiredReviewers = signingEnvironment.protection_rules?.find(
  (rule) => rule.type === 'required_reviewers',
)

const assertions = [
  ['main requires Security gates', requiredChecks.includes('Security gates')],
  [
    'main requires CodeQL',
    requiredChecks.includes('CodeQL JavaScript and TypeScript'),
  ],
  ['main blocks force pushes', protection.allow_force_pushes?.enabled === false],
  ['main blocks deletion', protection.allow_deletions?.enabled === false],
  ['main enforces administrators', protection.enforce_admins?.enabled === true],
  [
    'main requires pull-request review',
    protection.required_pull_request_reviews !== null,
  ],
  [
    'workflow token defaults to read-only',
    workflowPermissions.default_workflow_permissions === 'read',
  ],
  [
    'actions require full-SHA pinning',
    actionPermissions.sha_pinning_required === true,
  ],
  [
    'release-signing requires approval',
    (requiredReviewers?.reviewers?.length ?? 0) > 0,
  ],
  ['private vulnerability reporting is enabled', privateReporting.enabled === true],
]

const failed = assertions.filter(([, passed]) => !passed)
for (const [label, passed] of assertions) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
}
if (failed.length > 0) {
  throw new Error(`${failed.length} repository security setting(s) are missing`)
}
