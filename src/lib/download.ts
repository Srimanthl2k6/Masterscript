import manifest from '../../release-assets.json'
export const RELEASE_PAGE_URL = `https://github.com/${manifest.repository}/releases/latest`
export const DESKTOP_DOWNLOAD_LINKS = manifest.artifacts.map(artifact => ({ ...artifact, url: `${RELEASE_PAGE_URL}/download/${artifact.stable}` }))
export const MASTER_SCRIPT_DOWNLOAD_URL = DESKTOP_DOWNLOAD_LINKS[0].url
export const AUR_PUBLISHED = manifest.aurPublished
export const shouldShowDownloadButton = (isDesktopRuntime: boolean) => !isDesktopRuntime
export const detectDownloadPlatform = (userAgent: string): string | null => {
  if (/android|iphone|ipad/i.test(userAgent)) return null
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/macintosh|mac os/i.test(userAgent)) return 'macOS'
  if (/linux|x11/i.test(userAgent)) return 'Linux'
  return null
}
export const resolvePublicView = (desktop: boolean, hash: string, pathname = '/') =>
  desktop || hash.startsWith('#/app') || pathname.endsWith('/app') ? 'app' :
    hash.startsWith('#/download') || pathname.endsWith('/download') ? 'download' : 'landing'