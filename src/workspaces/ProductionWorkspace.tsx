import { Fragment, useMemo } from 'react'
import type { RefObject } from 'react'
import {
  buildCallSheet,
  buildDoodGrid,
  buildScriptSides,
  buildStripboard,
} from '../lib/productionTools'
import type {
  BreakdownKind,
  ScriptProject,
} from '../types/screenplay'
import type { extractScenes } from '../lib/screenplay'

type ScheduleEntry = ScriptProject['production']['schedule'][number]
type BreakdownEntry = ScriptProject['production']['breakdown'][number]
type Scene = ReturnType<typeof extractScenes>[number]

interface ProductionWorkspaceProps {
  project: ScriptProject
  scenes: Scene[]
  selectedShootDay: number
  setSelectedShootDay: (day: number) => void
  highlightedId: string | null
  itemRefs: RefObject<Record<string, HTMLElement | null>>
  addScheduleEntry: () => void
  regenerateProductionBreakdown: () => void
  exportDayOutOfDays: () => Promise<void>
  exportCallSheetPdf: () => Promise<void>
  exportScriptSidesPdf: () => Promise<void>
  exportCharacterDialogueReport: () => void
  addBreakdownEntity: (kind: BreakdownKind) => void
  setDraggingScheduleId: (id: string | null) => void
  reorderScheduleEntry: (targetEntryId: string) => void
  updateScheduleEntry: (
    entryId: string,
    updater: (entry: ScheduleEntry) => void,
  ) => void
  removeScheduleEntry: (entryId: string) => void
  setSelectedSceneId: (sceneId: string) => void
  updateBreakdownEntry: (
    entryId: string,
    updater: (entry: BreakdownEntry) => void,
  ) => void
  removeBreakdownEntry: (entryId: string) => void
}

const ProductionWorkspace = ({
  project,
  scenes,
  selectedShootDay,
  setSelectedShootDay,
  highlightedId,
  itemRefs,
  addScheduleEntry,
  regenerateProductionBreakdown,
  exportDayOutOfDays,
  exportCallSheetPdf,
  exportScriptSidesPdf,
  exportCharacterDialogueReport,
  addBreakdownEntity,
  setDraggingScheduleId,
  reorderScheduleEntry,
  updateScheduleEntry,
  removeScheduleEntry,
  setSelectedSceneId,
  updateBreakdownEntry,
  removeBreakdownEntry,
}: ProductionWorkspaceProps) => {
  const stripboardRows = useMemo(() => buildStripboard(project), [project])
  const doodGrid = useMemo(() => buildDoodGrid(project), [project])
  const availableShootDays = useMemo(
    () =>
      [...new Set(project.production.schedule.map((entry) => entry.day))]
        .filter((day) => day > 0)
        .sort((left, right) => left - right),
    [project.production.schedule],
  )
  const resolvedShootDay = availableShootDays.includes(selectedShootDay)
    ? selectedShootDay
    : availableShootDays[0] ?? 1
  const callSheetPreview = useMemo(
    () => buildCallSheet(project, resolvedShootDay),
    [project, resolvedShootDay],
  )
  const scriptSidesPreview = useMemo(
    () => buildScriptSides(project, resolvedShootDay),
    [project, resolvedShootDay],
  )
  const sceneById = useMemo(
    () => new Map(scenes.map((scene) => [scene.blockId, scene.heading])),
    [scenes],
  )
  const sceneNumberById = useMemo(
    () =>
      new Map(
        scenes.map((scene, index) => [
          scene.blockId,
          project.advanced.sceneNumbering.numbers[scene.blockId] ??
            String(index + 1),
        ]),
      ),
    [project.advanced.sceneNumbering.numbers, scenes],
  )

  return (
    <section className="module-layout module-surface tab-enter">
      <div className="module-heading">
        <h2>Stripboard and Schedule</h2>
        <div className="inline-actions">
          <select
            value={resolvedShootDay}
            onChange={(event) =>
              setSelectedShootDay(Number(event.target.value) || 1)
            }
          >
            {(availableShootDays.length > 0 ? availableShootDays : [1]).map(
              (day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ),
            )}
          </select>
          <button onClick={addScheduleEntry}>Add Schedule Row</button>
          <button onClick={regenerateProductionBreakdown}>Generate Breakdown</button>
          <button onClick={() => void exportDayOutOfDays()}>
            Export Day-Out-of-Days
          </button>
          <button onClick={() => void exportCallSheetPdf()}>Call Sheet PDF</button>
          <button onClick={() => void exportScriptSidesPdf()}>Sides PDF</button>
          <button onClick={exportCharacterDialogueReport}>
            Export Character Report
          </button>
          <button onClick={() => addBreakdownEntity('prop')}>Add Prop</button>
        </div>
      </div>

      <div className="production-tools-grid">
        <section className="production-tool-panel">
          <div className="module-heading compact-heading">
            <h2>Stripboard</h2>
          </div>
          <div className="stripboard-list">
            {stripboardRows.map((strip) => (
              <article
                key={strip.id}
                className="stripboard-strip"
                draggable
                onDragStart={() => setDraggingScheduleId(strip.id)}
                onDragEnd={() => setDraggingScheduleId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => reorderScheduleEntry(strip.id)}
                style={{ borderLeftColor: strip.color }}
              >
                <strong>
                  Day {strip.day} | S{strip.sceneNumber ?? '-'} | {strip.heading}
                </strong>
                <span>{strip.location || 'No location'}</span>
                <span>{strip.cast.length > 0 ? strip.cast.join(', ') : 'No cast'}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="production-tool-panel">
          <div className="module-heading compact-heading">
            <h2>Day-Out-of-Days</h2>
          </div>
          <div
            className="dood-grid"
            style={{
              gridTemplateColumns: `minmax(120px, 1fr) repeat(${Math.max(
                doodGrid.days.length,
                1,
              )}, 54px)`,
            }}
          >
            <strong>Character</strong>
            {doodGrid.days.map((day) => (
              <strong key={day}>D{day}</strong>
            ))}
            {doodGrid.rows.map((row) => (
              <Fragment key={row.character}>
                <span>{row.character}</span>
                {row.markers.map((marker, index) => (
                  <span key={`${row.character}-${doodGrid.days[index]}`}>
                    {marker}
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </section>

        <section className="production-tool-panel">
          <div className="module-heading compact-heading">
            <h2>Call Sheet Preview</h2>
          </div>
          <div className="call-sheet-preview">
            {callSheetPreview.scenes.map((scene) => (
              <span key={`${scene.sceneId ?? 'none'}-${scene.heading}`}>
                S{scene.sceneNumber ?? '-'} | {scene.heading}
              </span>
            ))}
            <strong>Cast</strong>
            <span>{callSheetPreview.cast.join(', ') || 'None'}</span>
            <strong>Crew</strong>
            <span>
              {callSheetPreview.crew.map((crew) => crew.name).join(', ') || 'None'}
            </span>
          </div>
        </section>

        <section className="production-tool-panel">
          <div className="module-heading compact-heading">
            <h2>Sides Preview</h2>
          </div>
          <div className="call-sheet-preview">
            {scriptSidesPreview.scenes.map((scene) => (
              <span key={scene.sceneId}>
                {scene.heading} | {scene.blocks.length} blocks
                {scene.hasRevisionMarks ? ' | revisions' : ''}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="table-layout">
        <div className="table-header">Day</div>
        <div className="table-header">Scene</div>
        <div className="table-header">Location</div>
        <div className="table-header">Notes</div>
        <div className="table-header">Actions</div>

        {project.production.schedule.map((entry) => (
          <Fragment key={entry.id}>
            <input
              ref={(node) => {
                itemRefs.current[entry.id] = node
              }}
              className={highlightedId === entry.id ? 'highlighted' : ''}
              type="number"
              min={1}
              value={entry.day}
              onChange={(event) =>
                updateScheduleEntry(entry.id, (target) => {
                  target.day = Number(event.target.value) || 1
                })
              }
            />
            <select
              value={entry.sceneId ?? ''}
              onChange={(event) =>
                updateScheduleEntry(entry.id, (target) => {
                  target.sceneId = event.target.value || null
                  if (event.target.value) {
                    setSelectedSceneId(event.target.value)
                  }
                })
              }
            >
              <option value="">Unassigned</option>
              {scenes.map((scene) => (
                <option key={scene.blockId} value={scene.blockId}>
                  S{sceneNumberById.get(scene.blockId) ?? '-'} - {scene.heading}
                </option>
              ))}
            </select>
            <input
              value={entry.location}
              onChange={(event) =>
                updateScheduleEntry(entry.id, (target) => {
                  target.location = event.target.value
                })
              }
              placeholder="Location"
            />
            <input
              value={entry.notes}
              onChange={(event) =>
                updateScheduleEntry(entry.id, (target) => {
                  target.notes = event.target.value
                })
              }
              placeholder="Shooting notes"
            />
            <button onClick={() => removeScheduleEntry(entry.id)}>Remove</button>
          </Fragment>
        ))}
      </div>

      <div className="module-heading subheading">
        <h2>Breakdown Entities</h2>
        <p className="small-copy">
          {project.production.breakdown.length} tracked items
        </p>
      </div>

      <div className="table-layout breakdown-table">
        <div className="table-header">Kind</div>
        <div className="table-header">Name</div>
        <div className="table-header">Scenes</div>
        <div className="table-header">Notes</div>
        <div className="table-header">Actions</div>

        {project.production.breakdown.map((entry) => (
          <Fragment key={entry.id}>
            <select
              value={entry.kind}
              onChange={(event) =>
                updateBreakdownEntry(entry.id, (target) => {
                  target.kind = event.target.value as BreakdownKind
                })
              }
            >
              <option value="cast">Cast</option>
              <option value="location">Location</option>
              <option value="prop">Prop</option>
              <option value="vehicle">Vehicle</option>
              <option value="equipment">Equipment</option>
              <option value="crew">Crew</option>
            </select>
            <input
              value={entry.name}
              onChange={(event) =>
                updateBreakdownEntry(entry.id, (target) => {
                  target.name = event.target.value
                })
              }
              placeholder="Entity name"
            />
            <p className="scene-pill-list">
              {entry.sceneIds.length === 0
                ? 'No linked scenes'
                : entry.sceneIds
                    .map((sceneId) => sceneById.get(sceneId) ?? sceneId)
                    .join(' | ')}
            </p>
            <input
              value={entry.notes}
              onChange={(event) =>
                updateBreakdownEntry(entry.id, (target) => {
                  target.notes = event.target.value
                })
              }
              placeholder="Notes"
            />
            <button onClick={() => removeBreakdownEntry(entry.id)}>Remove</button>
          </Fragment>
        ))}
      </div>
    </section>
  )
}

export default ProductionWorkspace
