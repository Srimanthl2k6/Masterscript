import {
  MAX_DOCX_COMPRESSED_BYTES,
  MAX_TEXT_IMPORT_BYTES,
} from './importLimits'

export const pickTextFile = (
  accept: string,
): Promise<{ name: string; content: string } | null> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      if (file.size > MAX_TEXT_IMPORT_BYTES) {
        reject(new Error('Text import exceeds the 10 MiB limit.'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          resolve(null)
          return
        }
        resolve({ name: file.name, content: reader.result })
      }
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })

export const pickBinaryFile = (
  accept: string,
): Promise<{ name: string; content: ArrayBuffer } | null> =>
  new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      if (file.size > MAX_DOCX_COMPRESSED_BYTES) {
        reject(new Error('DOCX compressed size exceeds the 25 MiB limit.'))
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          resolve(null)
          return
        }
        resolve({ name: file.name, content: reader.result })
      }
      reader.onerror = () => resolve(null)
      reader.readAsArrayBuffer(file)
    }
    input.click()
  })
