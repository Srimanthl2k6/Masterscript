import type { SceneSummary } from '../types/screenplay'

interface SceneOutlineItemProps {
  scene: SceneSummary
  numberLabel: string
  active: boolean
  color?: string
  locked: boolean
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
        <span>Scene</span>
        <input
          className="scene-number-input"
          value={numberLabel}
          disabled={locked}
          aria-label={`Scene number for ${scene.heading}`}
          title={
            locked
              ? 'Scene numbers are locked for this production draft'
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
