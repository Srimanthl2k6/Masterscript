const windowsDrivePath = /^[a-z]:[\\/]/i

export const isLikelyLocalProjectPath = (value: string): boolean =>
  (windowsDrivePath.test(value) ||
    value.startsWith('\\\\') ||
    value.startsWith('/')) &&
  /\.msproj\.json$/i.test(value)
