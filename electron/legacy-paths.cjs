const path = require('node:path')

const unique = (values) => [...new Set(values.filter(Boolean))]

const getLegacyDataCandidates = (platform, environment = process.env) => {
  const home = environment.HOME || environment.USERPROFILE || ''

  if (platform === 'win32') {
    const roaming = environment.APPDATA || (home ? path.win32.join(home, 'AppData', 'Roaming') : '')
    const local = environment.LOCALAPPDATA || (home ? path.win32.join(home, 'AppData', 'Local') : '')
    return unique([
      roaming && path.win32.join(roaming, 'MasterScript'),
      roaming && path.win32.join(roaming, 'masterscript'),
      local && path.win32.join(local, 'MasterScript'),
      local && path.win32.join(local, 'masterscript'),
    ])
  }

  if (platform === 'darwin') {
    const applicationSupport = home
      ? path.posix.join(home, 'Library', 'Application Support')
      : ''
    return unique([
      applicationSupport && path.posix.join(applicationSupport, 'MasterScript'),
      applicationSupport && path.posix.join(applicationSupport, 'masterscript'),
    ])
  }

  const configHome =
    environment.XDG_CONFIG_HOME || (home ? path.posix.join(home, '.config') : '')
  return unique([
    configHome && path.posix.join(configHome, 'MasterScript'),
    configHome && path.posix.join(configHome, 'masterscript'),
  ])
}

module.exports = { getLegacyDataCandidates }
