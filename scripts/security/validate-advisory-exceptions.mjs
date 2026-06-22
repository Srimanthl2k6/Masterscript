import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const exceptionFile =
  process.env.MASTERSCRIPT_ADVISORY_EXCEPTIONS ??
  '.security/advisory-exceptions.json'

export const readValidatedExceptions = (now = new Date()) => {
  const document = JSON.parse(readFileSync(exceptionFile, 'utf8'))
  if (document.schemaVersion !== 1 || !Array.isArray(document.exceptions)) {
    throw new Error('Advisory exception file must use schemaVersion 1')
  }

  const seen = new Set()
  for (const entry of document.exceptions) {
    for (const field of [
      'id',
      'owner',
      'rationale',
      'compensatingControl',
      'expires',
    ]) {
      if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
        throw new Error(`Advisory exception is missing ${field}`)
      }
    }
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate advisory exception: ${entry.id}`)
    }
    seen.add(entry.id)

    const expiry = new Date(`${entry.expires}T23:59:59.999Z`)
    if (Number.isNaN(expiry.getTime())) {
      throw new Error(`Invalid exception expiry for ${entry.id}`)
    }
    if (expiry < now) {
      throw new Error(`Expired advisory exception: ${entry.id}`)
    }
  }

  return document.exceptions
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exceptions = readValidatedExceptions()
  console.log(`Validated ${exceptions.length} advisory exception(s)`)
}
