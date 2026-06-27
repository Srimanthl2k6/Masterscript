const releaseBaseUrl =
  'https://github.com/Srimanthl2k6/Masterscript/releases/download/v0.6.1'

export const MASTER_SCRIPT_DOWNLOAD_URL =
  `${releaseBaseUrl}/MasterScript.Setup.exe`

export const DESKTOP_DOWNLOAD_LINKS = [
  {
    label: 'Windows',
    url: MASTER_SCRIPT_DOWNLOAD_URL,
  },
  {
    label: 'macOS',
    url: `${releaseBaseUrl}/MasterScript.mac.universal.dmg`,
  },
  {
    label: 'Linux AppImage',
    url: `${releaseBaseUrl}/MasterScript.linux.x86_64.AppImage`,
  },
]

export const shouldShowDownloadButton = (isDesktopRuntime: boolean) =>
  !isDesktopRuntime
