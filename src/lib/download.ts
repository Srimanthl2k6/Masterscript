const releaseBaseUrl =
  'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.1.2'

export const MASTER_SCRIPT_DOWNLOAD_URL =
  `${releaseBaseUrl}/MasterScript.Setup.0.1.2.exe`

export const DESKTOP_DOWNLOAD_LINKS = [
  {
    label: 'Windows',
    url: MASTER_SCRIPT_DOWNLOAD_URL,
  },
  {
    label: 'macOS',
    url: `${releaseBaseUrl}/MasterScript.mac.0.1.2.universal.dmg`,
  },
  {
    label: 'Linux AppImage',
    url: `${releaseBaseUrl}/MasterScript.linux.0.1.2.x86_64.AppImage`,
  },
]

export const shouldShowDownloadButton = (isElectron: boolean) => !isElectron
