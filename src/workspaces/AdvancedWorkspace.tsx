import { useMemo } from 'react'
import {
  buildAccessibilityExports,
  buildAdvancedNavigatorRows,
  buildAdvancedSidesPackage,
  buildLegalWorkflowLinks,
  buildPrintExportSettings,
  buildRevisionSlugList,
  buildScriptCheck,
  buildSeriesReviewFlags,
  buildTimingReport,
  buildTitlePageWarnings,
  buildWatermarkDescriptor,
  createDigitalSidesLink,
  currentYearCopyright,
  scriptFormatPresets,
  smartTypeExtensions,
  smartTypeTimesOfDay,
  smartTypeTransitions,
  technicalElementTemplates,
  updateAdvancedSettings,
} from '../lib/advancedMasterScript'
import { openExternalUrl } from '../lib/externalNavigation'
import type {
  CastStatus,
  ScriptFormatId,
  ScriptProject,
} from '../types/screenplay'

type TitlePageField = keyof ScriptProject['advanced']['titlePage']
type PrintExportField = keyof ReturnType<typeof buildPrintExportSettings>

interface AdvancedWorkspaceProps {
  project: ScriptProject
  resolvedShootDay: number
  characterSuggestions: string[]
  selectedCastStatusCharacter: string
  selectedCastStatus: CastStatus
  setSelectedCastStatusCharacter: (name: string) => void
  setSelectedCastStatus: (status: CastStatus) => void
  setAdvancedFormat: (format: ScriptFormatId) => void
  insertFormatTemplate: () => void
  updateAdvancedTitleField: (field: TitlePageField, value: string) => void
  applyAdvancedProject: (project: ScriptProject, message: string) => void
  beginProductionDraftAction: () => void
  exportCleanPdf: () => Promise<void>
  exportDirtyPdf: () => Promise<void>
  exportTableReadPdf: () => Promise<void>
  logRevisionDistributionNow: () => void
  exportRevisionLogCsv: () => void
  exportRevisionLogPdf: () => Promise<void>
  exportScriptCheckPdf: () => Promise<void>
  setSelectedBlockId: (id: string) => void
  queueFocus: (id: string) => void
  setCastStatusForCharacter: () => void
  exportOneLinerCsv: () => void
  exportOneLinerPdf: () => Promise<void>
  setStatusMessage: (message: string) => void
  addDefaultCoverage: () => void
  exportLatestCoveragePdf: () => Promise<void>
  addParkingLotFromSelection: () => void
  updatePrintWatermarkField: (
    field: PrintExportField,
    value: boolean | string,
  ) => void
  exportAdditionalFormat: (
    format: 'txt' | 'rtf' | 'html' | 'scene-csv' | 'workbook',
  ) => void
}

const AdvancedWorkspace = ({
  project,
  resolvedShootDay,
  characterSuggestions,
  selectedCastStatusCharacter,
  selectedCastStatus,
  setSelectedCastStatusCharacter,
  setSelectedCastStatus,
  setAdvancedFormat,
  insertFormatTemplate,
  updateAdvancedTitleField,
  applyAdvancedProject,
  beginProductionDraftAction,
  exportCleanPdf,
  exportDirtyPdf,
  exportTableReadPdf,
  logRevisionDistributionNow,
  exportRevisionLogCsv,
  exportRevisionLogPdf,
  exportScriptCheckPdf,
  setSelectedBlockId,
  queueFocus,
  setCastStatusForCharacter,
  exportOneLinerCsv,
  exportOneLinerPdf,
  setStatusMessage,
  addDefaultCoverage,
  exportLatestCoveragePdf,
  addParkingLotFromSelection,
  updatePrintWatermarkField,
  exportAdditionalFormat,
}: AdvancedWorkspaceProps) => {
  const scriptCheckResults = useMemo(() => buildScriptCheck(project), [project])
  const advancedTiming = useMemo(() => buildTimingReport(project), [project])
  const advancedNavigatorRows = useMemo(
    () => buildAdvancedNavigatorRows(project),
    [project],
  )
  const titlePageWarnings = useMemo(
    () => buildTitlePageWarnings(project),
    [project],
  )
  const revisionSlugList = useMemo(
    () => buildRevisionSlugList(project),
    [project],
  )
  const legalWorkflowLinks = useMemo(
    () => buildLegalWorkflowLinks(project),
    [project],
  )
  const accessibilityExports = useMemo(
    () => buildAccessibilityExports(project),
    [project],
  )
  const seriesReviewFlags = useMemo(
    () => buildSeriesReviewFlags(project),
    [project],
  )
  const printExportSettings = useMemo(
    () => buildPrintExportSettings(project),
    [project],
  )
  const watermarkDescriptor = useMemo(
    () => buildWatermarkDescriptor(project),
    [project],
  )
  const sidesPackage = useMemo(
    () => buildAdvancedSidesPackage(project, resolvedShootDay),
    [project, resolvedShootDay],
  )

  return (
    <section className="module-layout module-surface tab-enter">
      <div className="module-heading">
        <h2>Advanced Production Suite</h2>
        <div className="inline-actions">
          <button onClick={beginProductionDraftAction}>Begin Production Draft</button>
          <button onClick={() => void exportCleanPdf()}>Clean PDF</button>
          <button onClick={() => void exportDirtyPdf()}>Dirty PDF</button>
          <button onClick={() => void exportTableReadPdf()}>Table Read Draft</button>
        </div>
      </div>

      <div className="advanced-grid">
        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Formats and SmartType</h2>
          </div>
          <label>
            <span>Script Format</span>
            <select
              value={project.advanced.activeFormat}
              onChange={(event) =>
                setAdvancedFormat(event.target.value as ScriptFormatId)
              }
            >
              {scriptFormatPresets.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={insertFormatTemplate}>Insert Format Template</button>
          <div className="token-list">
            {[...smartTypeTimesOfDay, ...smartTypeTransitions, ...smartTypeExtensions]
              .slice(0, 28)
              .map((token) => (
                <span key={token}>{token}</span>
              ))}
          </div>
          <div className="token-list">
            {technicalElementTemplates.map((element) => (
              <span key={`${element.type}-${element.label}`}>{element.label}</span>
            ))}
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Title, Security, Legal</h2>
          </div>
          <input
            value={project.advanced.titlePage.writtenBy}
            onChange={(event) =>
              updateAdvancedTitleField('writtenBy', event.target.value)
            }
            placeholder="Written By"
          />
          <input
            value={project.advanced.titlePage.screenplayBy}
            onChange={(event) =>
              updateAdvancedTitleField('screenplayBy', event.target.value)
            }
            placeholder="Screenplay By"
          />
          <input
            value={project.advanced.titlePage.storyBy}
            onChange={(event) =>
              updateAdvancedTitleField('storyBy', event.target.value)
            }
            placeholder="Story By"
          />
          <input
            value={project.advanced.titlePage.basedOn}
            onChange={(event) =>
              updateAdvancedTitleField('basedOn', event.target.value)
            }
            placeholder="Based On"
          />
          <input
            value={project.advanced.titlePage.wgaRegistrationNumber}
            onChange={(event) =>
              updateAdvancedTitleField(
                'wgaRegistrationNumber',
                event.target.value,
              )
            }
            placeholder="WGA Registration #"
          />
          <input
            value={project.advanced.titlePage.copyrightNotice}
            onChange={(event) =>
              updateAdvancedTitleField('copyrightNotice', event.target.value)
            }
            placeholder={currentYearCopyright()}
          />
          <input
            value={project.advanced.titlePage.coverImageDataUrl}
            onChange={(event) =>
              updateAdvancedTitleField('coverImageDataUrl', event.target.value)
            }
            placeholder="Cover image data URL"
          />
          {titlePageWarnings.map((warning) => (
            <p className="small-copy" key={warning.code} title={warning.tooltip}>
              {warning.message}
            </p>
          ))}
          <label className="toggle-row compact">
            <input
              type="checkbox"
              checked={project.advanced.submissionLocked}
              onChange={(event) =>
                applyAdvancedProject(
                  updateAdvancedSettings(project, {
                    submissionLocked: event.target.checked,
                  }),
                  'Updated submission lock',
                )
              }
            />
            <span>Lock for submission</span>
          </label>
          <div className="inline-actions">
            <button
              title={legalWorkflowLinks.poorMansCopyrightTooltip}
              onClick={() => openExternalUrl(legalWorkflowLinks.wgaUrl)}
            >
              Register with WGA
            </button>
            <button
              title={legalWorkflowLinks.poorMansCopyrightTooltip}
              onClick={() => openExternalUrl(legalWorkflowLinks.copyrightUrl)}
            >
              Register Copyright
            </button>
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Revision and Page Control</h2>
          </div>
          <div className="inline-actions">
            <button onClick={logRevisionDistributionNow}>Log Distribution</button>
            <button onClick={exportRevisionLogCsv}>Revision CSV</button>
            <button onClick={() => void exportRevisionLogPdf()}>Revision PDF</button>
          </div>
          <div className="session-list">
            {project.advanced.revisionDistributionLog.map((event) => (
              <span key={event.id}>
                {event.date} | {event.color} | {event.pages.join(', ')} |{' '}
                {event.recipients}
              </span>
            ))}
          </div>
          <div className="token-list">
            {revisionSlugList.map((slug) => (
              <span key={slug}>{slug}</span>
            ))}
          </div>
          <p className="small-copy">
            Scene numbers:{' '}
            {project.advanced.sceneNumbering.locked ? 'Locked' : 'Unlocked'} |
            Fixed page mode: {project.advanced.fixedPageMode ? 'On' : 'Off'}
          </p>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Script Check</h2>
            <button onClick={() => void exportScriptCheckPdf()}>Notes PDF</button>
          </div>
          <div className="script-check-list">
            {scriptCheckResults.slice(0, 12).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.blockId) {
                    setSelectedBlockId(item.blockId)
                    queueFocus(item.blockId)
                  }
                }}
                title={item.tooltip}
              >
                <strong>{item.code}</strong>
                <span>
                  Scene {item.sceneNumber ?? '-'} | {item.message}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Cast, Sides, Schedule</h2>
          </div>
          <div className="custom-field-row">
            <select
              value={selectedCastStatusCharacter || characterSuggestions[0] || ''}
              onChange={(event) =>
                setSelectedCastStatusCharacter(event.target.value)
              }
            >
              {characterSuggestions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={selectedCastStatus}
              onChange={(event) =>
                setSelectedCastStatus(event.target.value as CastStatus)
              }
            >
              <option>Series Regular</option>
              <option>Recurring</option>
              <option>Guest Star</option>
              <option>Co-Star</option>
              <option>Day Player</option>
              <option>Under-5</option>
            </select>
          </div>
          <button onClick={setCastStatusForCharacter}>Set Cast Status</button>
          <div className="inline-actions">
            <button onClick={exportOneLinerCsv}>One-Liner CSV</button>
            <button onClick={() => void exportOneLinerPdf()}>One-Liner PDF</button>
            <button
              onClick={() =>
                setStatusMessage(
                  createDigitalSidesLink(project.id, {
                    expiresAt: new Date(Date.now() + 7 * 86_400_000)
                      .toISOString()
                      .slice(0, 10),
                  }),
                )
              }
            >
              Digital Sides Link
            </button>
          </div>
          <div className="session-list">
            {sidesPackage.coverCards.map((card) => (
              <span key={card.sceneId}>
                {card.sceneHeading} | {card.pageCount} pg |{' '}
                {card.cast.join(', ')}
              </span>
            ))}
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Timing and Navigator</h2>
          </div>
          <p className="timer-display">{advancedTiming.totalMinutes} min</p>
          <div className="navigator-enhancement-list">
            {advancedNavigatorRows.slice(0, 8).map((row) => (
              <article
                key={row.sceneId}
                title={`${row.wordCount} words | ${row.lineCount} lines`}
              >
                <strong>
                  {row.sceneNumber} {row.intExt} {row.dayNight}
                </strong>
                <span>{row.heading}</span>
                <i
                  style={{
                    width: `${row.lengthBarPercent}%`,
                    background: row.color,
                  }}
                />
                <small>{row.castInitials.join(' ')}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Coverage and Writer's Room</h2>
          </div>
          <div className="inline-actions">
            <button onClick={addDefaultCoverage}>Add Coverage</button>
            <button onClick={() => void exportLatestCoveragePdf()}>
              Coverage PDF
            </button>
            <button onClick={addParkingLotFromSelection}>Park Scene</button>
          </div>
          <p className="small-copy">
            Coverage forms: {project.advanced.coverage.length} | Parking lot:{' '}
            {project.advanced.writerRoom.parkingLot.length}
          </p>
          <textarea
            rows={4}
            value={project.advanced.series.bible}
            onChange={(event) =>
              applyAdvancedProject(
                updateAdvancedSettings(project, {
                  series: {
                    ...project.advanced.series,
                    bible: event.target.value,
                  },
                }),
                'Updated series bible',
              )
            }
            placeholder="Series bible"
          />
          {seriesReviewFlags.map((flag) => (
            <span className="small-copy" key={flag}>
              {flag}
            </span>
          ))}
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Print, Watermark, Accessibility</h2>
          </div>
          <label className="toggle-row compact">
            <input
              type="checkbox"
              checked={printExportSettings.draftInkSaver}
              onChange={(event) =>
                updatePrintWatermarkField('draftInkSaver', event.target.checked)
              }
            />
            <span>Draft ink saver</span>
          </label>
          <label className="toggle-row compact">
            <input
              type="checkbox"
              checked={printExportSettings.twoUp}
              onChange={(event) =>
                updatePrintWatermarkField('twoUp', event.target.checked)
              }
            />
            <span>Two-up printing</span>
          </label>
          <input
            value={printExportSettings.watermarkText}
            onChange={(event) =>
              updatePrintWatermarkField('watermarkText', event.target.value)
            }
            placeholder="Per-page watermark"
          />
          <input
            value={printExportSettings.recipientWatermark}
            onChange={(event) =>
              updatePrintWatermarkField(
                'recipientWatermark',
                event.target.value,
              )
            }
            placeholder="Recipient watermark"
          />
          <p className="small-copy">
            Watermark: {watermarkDescriptor.text || 'None'} |{' '}
            {watermarkDescriptor.position} | {watermarkDescriptor.opacity}
          </p>
          <div className="token-list">
            {accessibilityExports.formats.map((format) => (
              <span key={format}>{format}</span>
            ))}
          </div>
        </section>

        <section className="advanced-panel">
          <div className="module-heading compact-heading">
            <h2>Additional Exports</h2>
          </div>
          <div className="inline-actions">
            <button onClick={() => exportAdditionalFormat('txt')}>TXT</button>
            <button onClick={() => exportAdditionalFormat('rtf')}>RTF</button>
            <button onClick={() => exportAdditionalFormat('html')}>HTML</button>
            <button onClick={() => exportAdditionalFormat('scene-csv')}>
              Scene CSV
            </button>
            <button onClick={() => exportAdditionalFormat('workbook')}>
              Excel XML
            </button>
          </div>
        </section>
      </div>
    </section>
  )
}

export default AdvancedWorkspace
