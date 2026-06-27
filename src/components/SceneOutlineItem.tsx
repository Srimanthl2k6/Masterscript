import type { SceneSummary } from '../types/screenplay'

interface SceneOutlineItemProps {
  scene: SceneSummary
  numberLabel: string
  active: boolean
  color?: string
  locked: boolean
  manualMode: boolean
  actBreak?: string
  status?: string
  onNumberChange(value: string): void
  onSelect(): void
}

export default function SceneOutlineItem({
  scene,
  numberLabel,
  active,
  color,
  locked,
  manualMode,
  actBreak,
  status,
  onNumberChange,
  onSelect,
}: SceneOutlineItemProps) {
  return (
    <div
      className={active ? 'outline-item active' : 'outline-item'}
      style={{ borderLeftColor: color }}
    >
      <label className="scene-number-editor">
        <span>{manualMode ? 'Manual Scene' : 'Scene'}</span>
        <input
          className="scene-number-input"
          value={numberLabel}
          disabled={locked}
          aria-label={
            manualMode
              ? `Manual scene number for ${scene.heading}`
              : `Scene suffix for ${scene.heading}`
          }
          title={
            locked
              ? 'Scene numbers are locked for this production draft'
              : manualMode
                ? 'Manual numbering: edit the full number and optional letter suffix'
                : 'Edit the alphabetic scene suffix'
          }
          onChange={(event) => onNumberChange(event.target.value)}
        />
      </label>
      <button
        className="outline-scene-link"
        type="button"
        onClick={onSelect}
      >
        <span>{scene.heading}</span>
        {actBreak && <span>{actBreak}</span>}
        {status && <span>{status}</span>}
      </button>
    </div>
  )
}
