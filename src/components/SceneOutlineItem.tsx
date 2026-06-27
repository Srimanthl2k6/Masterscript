import type { SceneSummary } from '../types/screenplay'

interface SceneOutlineItemProps {
  scene: SceneSummary
  numberLabel: string
  active: boolean
  color?: string
  actBreak?: string
  status?: string
  onSelect(): void
}

export default function SceneOutlineItem({
  scene,
  numberLabel,
  active,
  color,
  actBreak,
  status,
  onSelect,
}: SceneOutlineItemProps) {
  return (
    <div
      className={active ? 'outline-item active' : 'outline-item'}
      style={{ borderLeftColor: color }}
    >
      <button
        className="outline-scene-link"
        type="button"
        onClick={onSelect}
      >
        <span>Scene {numberLabel}</span>
        <span>{scene.heading}</span>
        {actBreak && <span>{actBreak}</span>}
        {status && <span>{status}</span>}
      </button>
    </div>
  )
}
