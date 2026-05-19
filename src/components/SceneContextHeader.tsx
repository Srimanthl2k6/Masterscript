import type { SceneSummary } from '../types/screenplay'

interface SceneContextHeaderProps {
  activeTabLabel: string
  scenes: SceneSummary[]
  selectedSceneId: string | null
  onSelectScene: (sceneId: string) => void
  onJumpToDraft: (sceneId: string) => void
}

function SceneContextHeader({
  activeTabLabel,
  scenes,
  selectedSceneId,
  onSelectScene,
  onJumpToDraft,
}: SceneContextHeaderProps) {
  if (scenes.length === 0) {
    return (
      <section className="scene-context empty">
        <div>
          <p className="context-label">Scene Context</p>
          <strong>No scene headings yet</strong>
        </div>
        <p>Add a scene heading in Draft to activate cross-tab context.</p>
      </section>
    )
  }

  const selectedIndex = Math.max(
    0,
    scenes.findIndex((scene) => scene.blockId === selectedSceneId),
  )
  const selectedScene = scenes[selectedIndex]

  return (
    <section className="scene-context">
      <div>
        <p className="context-label">Scene Context</p>
        <strong>
          S{selectedIndex + 1} - {selectedScene.heading}
        </strong>
      </div>

      <div className="context-controls">
        <button
          onClick={() => onSelectScene(scenes[Math.max(0, selectedIndex - 1)].blockId)}
          disabled={selectedIndex === 0}
        >
          Prev Scene
        </button>
        <button
          onClick={() =>
            onSelectScene(
              scenes[Math.min(scenes.length - 1, selectedIndex + 1)].blockId,
            )
          }
          disabled={selectedIndex === scenes.length - 1}
        >
          Next Scene
        </button>
        <button onClick={() => onJumpToDraft(selectedScene.blockId)}>
          Jump To Draft
        </button>
      </div>

      <p className="context-label">Currently editing in {activeTabLabel}</p>
    </section>
  )
}

export default SceneContextHeader
