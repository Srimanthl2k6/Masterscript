import {
  buildAnalyticsDashboard,
  buildCharacterReport,
  buildDepartmentReport,
  buildDialogueReport,
  buildLocationReport,
  buildPageSceneSummary,
  buildSceneReport,
} from '../lib/reportsAnalytics'
import type { DepartmentTagCategory, ScriptProject } from '../types/screenplay'

export type ReportView =
  | 'scene'
  | 'character'
  | 'location'
  | 'department'
  | 'dialogue'
  | 'summary'
  | 'analytics'

export type ReportCell = string | number | string[]

export interface CurrentReport {
  title: string
  headers: string[]
  rows: ReportCell[][]
}

export const formatReportCell = (value: ReportCell): string =>
  Array.isArray(value) ? value.join(', ') : String(value)

export const buildCurrentReport = (
  project: ScriptProject,
  selectedReportView: ReportView,
  selectedReportDepartment: DepartmentTagCategory,
): CurrentReport => {
  switch (selectedReportView) {
    case 'character':
      return {
        title: 'Character Report',
        headers: ['Character', 'Scenes', 'Scene Count', 'Pages', 'Screen %'],
        rows: buildCharacterReport(project).map((row) => [
          row.character,
          row.scenes,
          row.sceneCount,
          row.totalPages,
          row.screenTimePercent,
        ]),
      }
    case 'location':
      return {
        title: 'Location Report',
        headers: ['Location', 'INT/EXT', 'Day/Night', 'Scenes', 'Pages'],
        rows: buildLocationReport(project).map((row) => [
          row.location,
          row.intExt,
          row.dayNight,
          row.scenes,
          row.totalPages,
        ]),
      }
    case 'department':
      return {
        title: `${selectedReportDepartment} Report`,
        headers: ['Category', 'Item', 'Scenes', 'Cost', 'Notes'],
        rows: buildDepartmentReport(project, selectedReportDepartment).map((row) => [
          row.category,
          row.item,
          row.scenes,
          row.cost,
          row.notes,
        ]),
      }
    case 'dialogue':
      return {
        title: 'Dialogue Report',
        headers: ['Character', 'Lines', 'Words', '% Total'],
        rows: buildDialogueReport(project).map((row) => [
          row.character,
          row.lines,
          row.words,
          row.percent,
        ]),
      }
    case 'summary': {
      const summary = buildPageSceneSummary(project)
      return {
        title: 'Page and Scene Count Summary',
        headers: ['Metric', 'Value'],
        rows: [
          ['Scenes', summary.sceneCount],
          ['Estimated Pages', summary.estimatedPages],
          ['Dialogue Lines', summary.dialogueLines],
          ['Words', summary.wordCount],
          ['Tagged Items', summary.taggedItems],
        ],
      }
    }
    case 'analytics': {
      const analytics = buildAnalyticsDashboard(project)
      return {
        title: 'Script Analytics Dashboard',
        headers: ['Metric', 'Value'],
        rows: [
          ['Dialogue Words', analytics.dialogueVsAction.dialogueWords],
          ['Action Words', analytics.dialogueVsAction.actionWords],
          ['Dialogue %', analytics.dialogueVsAction.dialoguePercent],
          ['Action %', analytics.dialogueVsAction.actionPercent],
          ...analytics.intExt.map((item) => [`INT/EXT ${item.label}`, item.value]),
          ...analytics.dayNight.map((item) => [`Day/Night ${item.label}`, item.value]),
        ],
      }
    }
    case 'scene':
    default:
      return {
        title: 'Scene Report',
        headers: ['#', 'Heading', 'INT/EXT', 'Day/Night', 'Cast', 'Pages'],
        rows: buildSceneReport(project).map((row) => [
          row.sceneNumber,
          row.heading,
          row.intExt,
          row.dayNight,
          row.castPresent,
          row.pageCount,
        ]),
      }
  }
}
