import { useEffect, useState } from 'react'
import { desktopBridge } from './desktop/desktopBridge'

const bundled = [
  'Courier Prime',
  'Inter',
  'Courier New',
  'Arial',
  'Georgia',
  'Times New Roman',
]

export const useInstalledFonts = (): string[] => {
  const [families, setFamilies] = useState(bundled)
  useEffect(() => {
    let cancelled = false
    void desktopBridge.listInstalledFonts().then((descriptors) => {
      if (!cancelled && descriptors.length > 0) {
        setFamilies(
          [...new Set([...bundled, ...descriptors.map(({ family }) => family)])]
            .sort((left, right) => left.localeCompare(right)),
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [])
  return families
}
