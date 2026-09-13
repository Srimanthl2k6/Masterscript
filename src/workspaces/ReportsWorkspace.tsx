import { Fragment, useMemo } from 'react'
import { useAnalysisProject } from '../lib/useAnalysisProject'
import {
  buildAnalyticsDashboard,
  buildSceneReport,
} from '../lib/reportsAnalytics'
import { departmentTagCategories } from '../lib/taggingBreakdown'
import type { DepartmentTagCategory, ScriptProject } from '../types/screenplay'
import {
  buildCurrentReport,
  formatReportCell,
  type ReportView,
} from './reportModel'

interface ReportsWorkspaceProps {
  project: ScriptProject
  selectedReportView: ReportView
  selectedReportDepartment: DepartmentTagCategory
  setSelectedReportView: (view: ReportView) => void
  setSelectedReportDepartment: (department: DepartmentTagCategory) => void
  exportCurrentReportCsv: () => Promise<void>
  exportCurrentReportPdf: () => Promise<void>
}

const ReportsWorkspace = ({
  project: currentProject,
  selectedReportView,
  selectedReportDepartment,
  setSelectedReportView,
  setSelectedReportDepartment,
  exportCurrentReportCsv,
  exportCurrentReportPdf,
}: ReportsWorkspaceProps) => {
  const project = useAnalysisProject(currentProject)
  const analyticsDashboard = useMemo(
    () => buildAnalyticsDashboard(project),
    [project],
  )
  const currentReport = useMemo(
    () =>
      buildCurrentReport(project, selectedReportView, selectedReportDepartment),
    [project, selectedReportDepartment, selectedReportView],
  )

  return (
    <section className="module-layout module-surface tab-enter">
      <div className="module-heading">
        <h2>Reports and Analytics</h2>
        <div className="inline-actions">
          <select
            aria-label="Report type"
            value={selectedReportView}
            onChange={(event) =>
              setSelectedReportView(event.target.value as ReportView)
            }
          >
            <option value="scene">Scene Report</option>
            <option value="character">Character Report</option>
            <option value="location">Location Report</option>
            <option value="department">Department Report</option>
            <option value="dialogue">Dialogue Report</option>
            <option value="summary">Page/Scene Summary</option>
            <option value="analytics">Analytics Dashboard</option>
          </select>
          {selectedReportView === 'department' && (
            <select
              aria-label="Report department"
              value={selectedReportDepartment}
              onChange={(event) =>
                setSelectedReportDepartment(
                  event.target.value as DepartmentTagCategory,
                )
              }
            >
              {departmentTagCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          )}
          <button onClick={() => void exportCurrentReportCsv()}>Export CSV</button>
          <button onClick={() => void exportCurrentReportPdf()}>Export PDF</button>
        </div>
      </div>

      {selectedReportView === 'analytics' && (
        <div className="analytics-grid">
          <section className="analytics-panel">
            <div className="module-heading compact-heading">
              <h2>INT vs EXT</h2>
            </div>
            {analyticsDashboard.intExt.map((item) => (
              <div className="chart-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${Math.max(8, item.value * 22)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </section>

          <section className="analytics-panel">
            <div className="module-heading compact-heading">
              <h2>Day vs Night</h2>
            </div>
            {analyticsDashboard.dayNight.map((item) => (
              <div className="chart-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${Math.max(8, item.value * 22)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </section>

          <section className="analytics-panel">
            <div className="module-heading compact-heading">
              <h2>Dialogue vs Action</h2>
            </div>
            <div className="ratio-chart">
              <span
                style={{
                  width: `${analyticsDashboard.dialogueVsAction.dialoguePercent}%`,
                }}
              />
              <b
                style={{
                  width: `${analyticsDashboard.dialogueVsAction.actionPercent}%`,
                }}
              />
            </div>
            <p className="small-copy">
              Dialogue {analyticsDashboard.dialogueVsAction.dialogueWords} words |
              Action {analyticsDashboard.dialogueVsAction.actionWords} words
            </p>
          </section>

          <section className="analytics-panel">
            <div className="module-heading compact-heading">
              <h2>Scene Length</h2>
            </div>
            {analyticsDashboard.sceneLengthHistogram.map((item) => (
              <div className="chart-bar-row" key={item.sceneNumber}>
                <span>S{item.sceneNumber}</span>
                <div>
                  <i style={{ width: `${Math.max(8, item.words * 2)}%` }} />
                </div>
                <strong>{item.words}</strong>
              </div>
            ))}
          </section>
        </div>
      )}

      {selectedReportView === 'scene' ? <div className="tag-catalog-grid">
        {buildSceneReport(project).map(scene => <article className="tagging-panel" key={scene.sceneId}>
          <h3>{scene.sceneLabel}. {scene.heading}</h3>
          <p className="small-copy">{scene.intExt} {scene.location} · {scene.dayNight} · {scene.pageCount} estimated page(s)</p>
          <p><strong>Cast:</strong> {scene.castPresent.join(', ') || 'None identified'}</p>
          {scene.nonSpeakingCast.length > 0 && <p><strong>Non-speaking:</strong> {scene.nonSpeakingCast.join(', ')}</p>}
          {Object.entries(scene.requirements).filter(([category]) => !['Cast', 'Locations'].includes(category)).map(([category, items]) => <p key={category}><strong>{category}:</strong> {items.join(', ')}</p>)}
        </article>)}
      </div> : <div className="report-table-wrap">
        <h3>{currentReport.title}</h3>
        <div
          className="report-table"
          style={{
            gridTemplateColumns: `repeat(${Math.max(
              currentReport.headers.length,
              1,
            )}, minmax(120px, 1fr))`,
          }}
        >
          {currentReport.headers.map((header) => (
            <strong key={header}>{header}</strong>
          ))}
          {currentReport.rows.map((row, rowIndex) => (
            <Fragment key={`${currentReport.title}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <span key={`${currentReport.title}-${rowIndex}-${cellIndex}`}>
                  {formatReportCell(cell)}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>}
    </section>
  )
}

export default ReportsWorkspace
