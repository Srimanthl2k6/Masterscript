export class AdapterError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AdapterError'
    this.code = code
    this.details = details
  }
}

export class AdapterParseError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super('PARSE_ERROR', message, details)
    this.name = 'AdapterParseError'
  }
}

export class AdapterValidationError extends AdapterError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details)
    this.name = 'AdapterValidationError'
  }
}
