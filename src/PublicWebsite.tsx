import { lazy, Suspense, useEffect, useState } from 'react'
import { AUR_PUBLISHED, DESKTOP_DOWNLOAD_LINKS, RELEASE_PAGE_URL, detectDownloadPlatform, resolvePublicView } from './lib/download'
import { desktopBridge } from './lib/desktop/desktopBridge'
import type { InstallState } from './lib/desktop/types'
import './publicWebsite.css'

const App = lazy(() => import('./App'))
export default function PublicWebsite({ initialInstallState }: { initialInstallState: InstallState | null }) {
  const [view, setView] = useState(() => resolvePublicView(desktopBridge.runtime !== 'web', window.location.hash, window.location.pathname))
  useEffect(() => {
    const changed = () => setView(resolvePublicView(desktopBridge.runtime !== 'web', window.location.hash, window.location.pathname))
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  if (view === 'app') return <Suspense fallback={<p className="public-loading">Opening MasterScript…</p>}><App initialInstallState={initialInstallState} /></Suspense>
  const platform = detectDownloadPlatform(navigator.userAgent)
  if (view === 'landing') return <main className="public-landing">
    <div className="public-identity"><img src={`${import.meta.env.BASE_URL}masterscript-logo.png`} alt="MasterScript logo" width="220" height="220" /><h1>MasterScript</h1></div>
    <nav className="public-choices" aria-label="Choose how to use MasterScript"><a className="public-primary" href="#/app">Use Web <span aria-hidden="true">↗</span></a><a href="#/download">Download <span aria-hidden="true">↓</span></a></nav>
  </main>
  return <main className="public-downloads">
    <header><a href="#/" className="public-wordmark"><img src={`${import.meta.env.BASE_URL}masterscript-logo.png`} alt="MasterScript logo" width="44" height="44" />MasterScript</a><a href="#/app">Use Web ↗</a></header>
    <h1>Your screenplay.<br /><span>Your workspace.</span></h1><p>Download the latest stable MasterScript release.</p>
    {['Windows', 'macOS', 'Linux', 'Terminal'].map(group => <section className="download-platform" key={group}>
      <h2>{group}</h2><div className="download-options">{DESKTOP_DOWNLOAD_LINKS.filter(link => link.platform === group).map(link => <a key={link.id} className="download-option" href={link.url}>
        <div><strong>{link.label}</strong>{'recommended' in link && link.recommended && group === platform && <span className="download-recommended">Recommended</span>}</div>
        <span className="download-format">{link.format} <span aria-hidden="true">↓</span></span><p>{link.description}</p>
      </a>)}</div>
      {group === 'Linux' && AUR_PUBLISHED && <p>Arch AUR: <code>yay -S masterscript-bin</code></p>}
    </section>)}
    <footer><a href={RELEASE_PAGE_URL}>Release notes, checksums and all assets ↗</a><p>If a download is unavailable, open the release page to check the published files.</p></footer>
  </main>
}
