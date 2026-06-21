import { useMemo } from 'react'
import {
  autoTagScript,
  buildBreakdownSheet,
  buildTagCatalog,
  departmentTagCategories,
  departmentTagColors,
  type AutoTagSuggestion,
} from '../lib/taggingBreakdown'
import type {
  DepartmentTagCategory,
  ScriptProject,
  TagCatalogItem,
} from '../types/screenplay'

interface BreakdownWorkspaceProps {
  project: ScriptProject
  selectedSceneId: string | null
  selectedTagCategory: DepartmentTagCategory
  tagPhrase: string
  setSelectedTagCategory: (category: DepartmentTagCategory) => void
  setTagPhrase: (phrase: string) => void
  applyManualTag: () => void
  confirmAutoTag: (suggestion: AutoTagSuggestion) => void
  updateTagCatalog: (
    itemId: string,
    updates: Partial<
      Pick<TagCatalogItem, 'cost' | 'notes' | 'imageDataUrl' | 'name'>
    >,
  ) => void
  exportBreakdownCsv: () => void
  exportBreakdownPdf: () => Promise<void>
}

const BreakdownWorkspace = ({
  project,
  selectedSceneId,
  selectedTagCategory,
  tagPhrase,
  setSelectedTagCategory,
  setTagPhrase,
  applyManualTag,
  confirmAutoTag,
  updateTagCatalog,
  exportBreakdownCsv,
  exportBreakdownPdf,
}: BreakdownWorkspaceProps) => {
  const tagCatalogGroups = useMemo(() => buildTagCatalog(project), [project])
  const autoTagSuggestions = useMemo(
    () => autoTagScript(project).slice(0, 40),
    [project],
  )
  const selectedBreakdownSheet = useMemo(
    () => buildBreakdownSheet(project, selectedSceneId),
    [project, selectedSceneId],
  )

  return (
    <section className="module-layout module-surface tab-enter">
      <div className="module-heading">
        <h2>Tagging and Breakdown</h2>
        <div className="inline-actions">
          <button onClick={applyManualTag}>Apply Tag</button>
          <button onClick={exportBreakdownCsv}>Breakdown CSV</button>
          <button onClick={() => void exportBreakdownPdf()}>Breakdown PDF</button>
        </div>
      </div>

      <div className="tagging-grid">
        <section className="tagging-panel">
          <div className="module-heading compact-heading">
            <h2>Inline Tagging</h2>
          </div>
          <label>
            <span>Category</span>
            <select
              value={selectedTagCategory}
              onChange={(event) =>
                setSelectedTagCategory(
                  event.target.value as DepartmentTagCategory,
                )
              }
            >
              {departmentTagCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Selected Phrase</span>
            <input
              value={tagPhrase}
              onChange={(event) => setTagPhrase(event.target.value)}
              placeholder="Highlight in Draft or type phrase"
            />
          </label>
          <div className="tag-swatch-row">
            {departmentTagCategories.map((category) => (
              <button
                key={category}
                className={category === selectedTagCategory ? 'active' : ''}
                onClick={() => setSelectedTagCategory(category)}
                style={{ borderColor: departmentTagColors[category] }}
              >
                <span style={{ background: departmentTagColors[category] }} />
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="tagging-panel">
          <div className="module-heading compact-heading">
            <h2>Auto-Tag Suggestions</h2>
          </div>
          <div className="tag-suggestion-list">
            {autoTagSuggestions.length === 0 && (
              <p className="small-copy">No local suggestions found.</p>
            )}
            {autoTagSuggestions.map((suggestion) => (
              <button
                key={`${suggestion.blockId}-${suggestion.category}-${suggestion.start}`}
                onClick={() => confirmAutoTag(suggestion)}
                style={{ borderLeftColor: suggestion.color }}
              >
                <strong>{suggestion.category}</strong>
                <span>{suggestion.text}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="tagging-panel breakdown-sheet-panel">
          <div className="module-heading compact-heading">
            <h2>Scene Breakdown</h2>
          </div>
          <strong>{selectedBreakdownSheet.sceneHeading}</strong>
          <div className="breakdown-category-list">
            {departmentTagCategories.map((category) => {
              const items = selectedBreakdownSheet.categories[category] ?? []
              if (items.length === 0) {
                return null
              }

              return (
                <article key={category}>
                  <h3>{category}</h3>
                  {items.map((item) => (
                    <span key={item.id}>
                      {item.name} | {item.occurrences.length} occurrence(s)
                    </span>
                  ))}
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <div className="tag-catalog-grid">
        {departmentTagCategories.map((category) => {
          const items = tagCatalogGroups[category] ?? []
          if (items.length === 0) {
            return null
          }

          return (
            <section className="tagging-panel" key={category}>
              <div className="module-heading compact-heading">
                <h2>{category}</h2>
              </div>
              {items.map((item) => (
                <article className="tag-catalog-item" key={item.id}>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateTagCatalog(item.id, { name: event.target.value })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.cost}
                    onChange={(event) =>
                      updateTagCatalog(item.id, {
                        cost: Number(event.target.value) || 0,
                      })
                    }
                    placeholder="Cost"
                  />
                  <input
                    value={item.notes}
                    onChange={(event) =>
                      updateTagCatalog(item.id, { notes: event.target.value })
                    }
                    placeholder="Notes"
                  />
                  <input
                    value={item.imageDataUrl}
                    onChange={(event) =>
                      updateTagCatalog(item.id, {
                        imageDataUrl: event.target.value,
                      })
                    }
                    placeholder="Image data URL or reference"
                  />
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </section>
  )
}

export default BreakdownWorkspace
