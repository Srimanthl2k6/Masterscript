import type { ScriptProject } from '../../types/screenplay'

export interface AdapterWarning {
  code: string
  message: string
}

export interface AdapterResult<T> {
  data: T
  warnings: AdapterWarning[]
}

export type ScriptProjectAdapterResult = AdapterResult<ScriptProject>
