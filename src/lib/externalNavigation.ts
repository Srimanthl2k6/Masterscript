type OpenExternalWindow = (
  url: string,
  target: string,
  features: string,
) => { opener: unknown } | null

export const openExternalUrl = (
  value: string,
  open: OpenExternalWindow = window.open.bind(window),
): void => {
  const url = new URL(value)
  if (url.protocol !== 'https:') {
    throw new Error('External links must use HTTPS.')
  }
  const opened = open(url.toString(), '_blank', 'noopener,noreferrer')
  if (opened) {
    opened.opener = null
  }
}

