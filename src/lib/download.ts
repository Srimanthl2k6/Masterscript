const downloadReleaseVersion = '0.2.0'
const releaseBaseUrl =
  `https://github.com/Srimanthl2k6/Masterscript/releases/download/v${downloadReleaseVersion}`

export const MASTER_SCRIPT_DOWNLOAD_URL =
  `${releaseBaseUrl}/MasterScript.Setup.${downloadReleaseVersion}.exe`

export const DESKTOP_DOWNLOAD_LINKS = [
  {
    label: 'Windows',
    url: MASTER_SCRIPT_DOWNLOAD_URL,
  },
  {
    label: 'macOS',
    url: `${releaseBaseUrl}/MasterScript.mac.${downloadReleaseVersion}.universal.dmg`,
  },
  {
    label: 'Linux AppImage',
    url: `${releaseBaseUrl}/MasterScript.linux.${downloadReleaseVersion}.x86_64.AppImage`,
  },
]

export const shouldShowDownloadButton = (isDesktopRuntime: boolean) =>
  !isDesktopRuntime
