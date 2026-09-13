import { useMemo, useState } from 'react'
import {
  addCatalogOccurrence, buildBreakdownSheet, createCatalogItem, departmentTagCategories,
  removeTagCatalogItem, removeTagOccurrence, resolveTagging, restoreAutomaticBreakdown,
  updateTagCatalogItem,
} from '../lib/taggingBreakdown'
import { extractScenes } from '../lib/screenplay'
import { clearSceneAnalysisCache } from '../lib/sceneAnalysis'
import type { DepartmentTagCategory, ScriptProject } from '../types/screenplay'

interface BreakdownWorkspaceProps {
  project: ScriptProject
  selectedSceneId: string | null
  onProjectChange: (project: ScriptProject, status: string) => void
  onSceneChange: (sceneId: string) => void
  exportBreakdownCsv: () => void
  exportBreakdownPdf: () => Promise<void>
  selectedTagCategory: DepartmentTagCategory
  tagPhrase: string
  setSelectedTagCategory: (category: DepartmentTagCategory) => void
  setTagPhrase: (phrase: string) => void
  applyManualTag: () => void
}

const BreakdownWorkspace = ({ project, selectedSceneId, onProjectChange, onSceneChange, exportBreakdownCsv, exportBreakdownPdf, selectedTagCategory, tagPhrase, setSelectedTagCategory, setTagPhrase, applyManualTag }: BreakdownWorkspaceProps) => {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DepartmentTagCategory>('Props')
  const [unassigned, setUnassigned] = useState(false)
  const scenes = useMemo(() => extractScenes(project), [project])
  const sceneId = unassigned ? null : selectedSceneId ?? scenes[0]?.blockId ?? null
  const sheet = useMemo(() => buildBreakdownSheet(project, sceneId), [project, sceneId])
  const tagging = useMemo(() => resolveTagging(project), [project])
  const change = (next: ScriptProject, status = 'Updated breakdown') => onProjectChange(next, status)
  return (
    <section className="module-layout module-surface tab-enter">
      <div className="module-heading">
        <h2>Scene Breakdown</h2>
        <div className="inline-actions">
          <button onClick={() => { clearSceneAnalysisCache(); change({ ...project }, 'Reanalysed screenplay; corrections preserved') }}>Reanalyse</button>
          <button onClick={() => change(restoreAutomaticBreakdown(project), 'Restored rejected automatic items')}>Restore rejected items</button>
          <button onClick={exportBreakdownCsv}>Breakdown CSV</button>
          <button onClick={() => void exportBreakdownPdf()}>Breakdown PDF</button>
        </div>
      </div>
      <p className="small-copy">A local first pass from your screenplay. Edit any item; your corrections and rejected items survive reanalysis.</p>
      <details><summary>Tag a screenplay phrase</summary><div className="inline-actions">
        <input aria-label="Selected phrase" value={tagPhrase} onChange={event => setTagPhrase(event.target.value)} />
        <select aria-label="Phrase department" value={selectedTagCategory} onChange={event => setSelectedTagCategory(event.target.value as DepartmentTagCategory)}>{departmentTagCategories.map(category => <option key={category}>{category}</option>)}</select>
        <button onClick={applyManualTag}>Apply Tag</button>
      </div></details>
      <label>Scene
        <select value={sceneId ?? ''} onChange={event => { setUnassigned(!event.target.value); if (event.target.value) onSceneChange(event.target.value) }}>
          <option value="">Unassigned items</option>
          {scenes.map((scene, index) => <option key={scene.blockId} value={scene.blockId}>{index + 1}. {scene.heading}</option>)}
        </select>
      </label>
      <form className="inline-actions" onSubmit={event => { event.preventDefault(); change(createCatalogItem(project, category, name, sceneId), 'Added breakdown item'); setName('') }}>
        <input aria-label="New breakdown item" placeholder="Add an item to this scene" value={name} onChange={event => setName(event.target.value)} />
        <select aria-label="New item department" value={category} onChange={event => setCategory(event.target.value as DepartmentTagCategory)}>{departmentTagCategories.map(category => <option key={category}>{category}</option>)}</select>
        <button disabled={!name.trim()}>Add item</button>
      </form>
      <div className="tag-catalog-grid">
        {departmentTagCategories.map(category => {
          const items = sheet.categories[category] ?? []
          if (!items.length) return null
          return <section className="tagging-panel" key={category}>
            <h3>{category} <small>({items.length})</small></h3>
            {items.map(item => <article className="tag-catalog-item" key={item.id}>
              <div className="inline-actions"><small>{item.source ?? 'manual'} · {item.occurrences.length} occurrence(s)</small>
                {item.source === 'automatic' && <button onClick={() => change(updateTagCatalogItem(project, item.id, { source: 'confirmed' }))}>Confirm</button>}
                <button onClick={() => change(removeTagCatalogItem(project, item.id), 'Removed item; automatic inference suppressed')}>{item.source === 'automatic' ? 'Reject' : 'Delete'}</button>
              </div>
              <label>Item<input value={item.name} onChange={event => change(updateTagCatalogItem(project, item.id, { name: event.target.value }))} /></label>
              <label>Department<select value={item.category} onChange={event => change(updateTagCatalogItem(project, item.id, { category: event.target.value as DepartmentTagCategory }))}>{departmentTagCategories.map(category => <option key={category}>{category}</option>)}</select></label>
              <label>Cost<input type="number" min={0} value={item.cost} onChange={event => change(updateTagCatalogItem(project, item.id, { cost: Number(event.target.value) || 0 }))} /></label>
              <label>Notes<input value={item.notes} onChange={event => change(updateTagCatalogItem(project, item.id, { notes: event.target.value }))} /></label>
              <details><summary>Scenes and occurrences</summary>
                {tagging.tags.filter(tag => tag.catalogItemId === item.id).map(tag => <div className="inline-actions" key={tag.id}>
                  <span>{scenes.find(scene => scene.blockId === tag.sceneId)?.heading ?? 'Unassigned'}{tag.quantity ? ` · approx. ${tag.quantity}` : ''}</span>
                  <button aria-label={`Remove occurrence of ${item.name}`} onClick={() => change(removeTagOccurrence(project, tag.id))}>Remove</button>
                </div>)}
                <label>Add occurrence in scene<select value="" onChange={event => { if (event.target.value) change(addCatalogOccurrence(project, item.id, event.target.value)) }}>
                  <option value="">Choose scene…</option>{scenes.map(scene => <option key={scene.blockId} value={scene.blockId}>{scene.heading}</option>)}
                </select></label>
              </details>
            </article>)}
          </section>
        })}
      </div>
      {!Object.keys(sheet.categories).length && <p className="small-copy">No production elements in this scene yet. Add an item above or write a scene to begin.</p>}
    </section>
  )
}
export default BreakdownWorkspace
