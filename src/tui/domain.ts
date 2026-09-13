import { blockTypeOrder, type DepartmentTagCategory, type ScriptProject } from '../types/screenplay'
import { createBlock, createEmptyProject, extractScenes } from '../lib/screenplay'
import { hydrateProject } from '../lib/projectHydration'
import { splitBlock } from '../lib/splitBlock'
import { updateBlockTextWithRevisionTracking } from '../lib/revisionProduction'
import { updateRangesForTextEdit } from '../lib/richText'
import { commitProjectHistory, createProjectHistory, redoProjectHistory, undoProjectHistory } from '../lib/projectHistory'
import { buildCurrentReport, type ReportView } from '../workspaces/reportModel'
import { addCatalogOccurrence, createCatalogItem, departmentTagCategories, removeTagCatalogItem, removeTagOccurrence, resolveTagging, updateTagCatalogItem } from '../lib/taggingBreakdown'
import { MAX_PROJECT_JSON_BYTES } from '../lib/adapters/importLimits'

export interface TerminalCommand { op: string; value?: string; amount?: number; id?: string; category?: DepartmentTagCategory }
export const createTerminalSession = () => {
  let history = createProjectHistory(createEmptyProject())
  let index = 0
  let caret = 0
  let saved = JSON.stringify(history.present)
  let message = 'Ready. F1 for shortcuts.'
  let view = 'editor'
  let panel = ''
  const commit = (project: ScriptProject) => { history = commitProjectHistory(history, draft => Object.assign(draft, project), 'Terminal edit') }
  const breakdownPanel = (project: ScriptProject) => {
    const tagging = resolveTagging(project)
    return tagging.catalog.map(item => `${item.id}\n${item.category}: ${item.name} | ${item.source ?? 'manual'} | Cost ${item.cost}\n${item.notes}\n${tagging.tags.filter(tag => tag.catalogItemId === item.id).map(tag => `  ${tag.id} · ${tag.sceneId ?? 'unassigned'}`).join('\n')}`).join('\n\n')
  }
  const dispatch = (command: TerminalCommand) => {
    const project = history.present
    const block = project.blocks[index]
    const value = command.value ?? ''
    const sceneId = project.blocks.slice(0, index + 1).findLast(block => block.type === 'scene-heading')?.id ?? null
    const canEdit = () => {
      const scene = project.blocks.find(item => item.id === sceneId)
      return !block.locked && !block.omitted && !scene?.omitted && !scene?.locked
    }
    const textEdit = (text: string, cursor: number) => {
      if (!canEdit()) { message = 'Locked or omitted block'; return }
      const result = updateBlockTextWithRevisionTracking(project, block.id, text)
      result.project.blocks[index].formatRanges = updateRangesForTextEdit(block.text, text, block.formatRanges)
      commit(result.project)
      caret = cursor
    }
    switch (command.op) {
      case 'new': history = createProjectHistory(createEmptyProject()); index = 0; caret = 0; saved = ''; view = 'editor'; break
      case 'open': {
        if (value.length > MAX_PROJECT_JSON_BYTES) throw new Error('Project exceeds the import limit')
        const parsed = hydrateProject(JSON.parse(value))
        history = createProjectHistory(parsed); index = 0; caret = 0; saved = JSON.stringify(parsed); view = 'editor'; message = 'Project opened'; break
      }
      case 'serialize': return { json: JSON.stringify(history.present, null, 2) }
      case 'saved': saved = JSON.stringify(history.present); message = 'Saved'; break
      case 'insert': textEdit(block.text.slice(0, caret) + value + block.text.slice(caret), caret + value.length); break
      case 'backspace': {
        const previous = [...block.text.slice(0, caret)].at(-1)?.length ?? 0
        textEdit(block.text.slice(0, caret - previous) + block.text.slice(caret), caret - previous); break
      }
      case 'delete-char': {
        const length = [...block.text.slice(caret)][0]?.length ?? 0
        textEdit(block.text.slice(0, caret) + block.text.slice(caret + length), caret); break
      }
      case 'split': {
        const result = splitBlock(project, block.id, { start: caret, end: caret })
        if (result.blocked) { message = 'Locked or omitted block'; break }
        commit(result.project); index += 1; caret = 0; break
      }
      case 'insert-block': {
        if (!canEdit()) break
        const next = structuredClone(project)
        next.blocks.splice(index + 1, 0, createBlock('action'))
        commit(next); index += 1; caret = 0; break
      }
      case 'delete-block': {
        if (!canEdit()) break
        const next = structuredClone(project)
        next.blocks.splice(index, 1)
        if (!next.blocks.length) next.blocks.push(createBlock('action'))
        commit(next); index = Math.min(index, next.blocks.length - 1); caret = 0; break
      }
      case 'type': {
        if (!canEdit()) break
        const next = structuredClone(project)
        next.blocks[index].type = blockTypeOrder[(blockTypeOrder.indexOf(block.type) + 1) % blockTypeOrder.length]
        commit(next); break
      }
      case 'move': {
        const amount = command.amount ?? 1
        const step = amount < 0 ? ([...block.text.slice(0, caret)].at(-1)?.length ?? 0) * -1 : [...block.text.slice(caret)][0]?.length ?? 0
        caret = Math.max(0, Math.min(block.text.length, caret + step)); break
      }
      case 'home': caret = 0; break
      case 'end': caret = block.text.length; break
      case 'navigate': index = Math.max(0, Math.min(project.blocks.length - 1, index + (command.amount ?? 1))); caret = Math.min(caret, project.blocks[index].text.length); break
      case 'scene': {
        const scenes = extractScenes(project)
        const current = scenes.findIndex(scene => scene.blockId === sceneId)
        index = scenes[Math.max(0, Math.min(scenes.length - 1, current + (command.amount ?? 1)))]?.index ?? index; caret = 0; break
      }
      case 'search': {
        const ordered = [...project.blocks.slice(index + 1), ...project.blocks.slice(0, index + 1)]
        const found = ordered.find(block => block.text.toLocaleLowerCase().includes(value.toLocaleLowerCase()))
        if (found && value) { index = project.blocks.indexOf(found); caret = found.text.toLocaleLowerCase().indexOf(value.toLocaleLowerCase()); message = `Found: ${value}` }
        else message = 'No match'; break
      }
      case 'title': case 'author': commit({ ...project, meta: { ...project.meta, [command.op]: value } }); break
      case 'undo': history = undoProjectHistory(history); break
      case 'redo': history = redoProjectHistory(history); break
      case 'editor': view = 'editor'; break
      case 'report': {
        const report = buildCurrentReport(project, value as ReportView, command.category ?? 'Props')
        panel = [report.title, '', ...report.rows.map(row => report.headers.map((header, i) => `${header}: ${Array.isArray(row[i]) ? row[i].join(', ') : row[i]}`).join('\n'))].join('\n\n')
        view = 'report'; break
      }
      case 'breakdown': panel = breakdownPanel(project); view = 'breakdown'; break
      case 'add-item': commit(createCatalogItem(project, command.category ?? 'Props', value, sceneId)); break
      case 'remove-item': commit(removeTagCatalogItem(project, command.id ?? '')); break
      case 'remove-occurrence': commit(removeTagOccurrence(project, command.id ?? '')); break
      case 'add-occurrence': commit(addCatalogOccurrence(project, command.id ?? '', value)); break
      case 'edit-item': {
        const updates = JSON.parse(value) as Record<string, unknown>
        const allowed = Object.fromEntries(Object.entries(updates).filter(([key]) => ['name', 'notes', 'cost', 'category', 'source'].includes(key)))
        if ('category' in allowed && !departmentTagCategories.includes(allowed.category as DepartmentTagCategory)) throw new Error('Unknown department')
        for (const field of ['name', 'notes']) if (field in allowed && typeof allowed[field] !== 'string') throw new Error(`${field} must be text`)
        if ('cost' in allowed && (typeof allowed.cost !== 'number' || !Number.isFinite(allowed.cost) || allowed.cost < 0)) throw new Error('Cost must be a non-negative number')
        if ('source' in allowed && !['manual', 'confirmed', 'edited'].includes(allowed.source as string)) throw new Error('Source must be manual, confirmed or edited')
        commit(updateTagCatalogItem(project, command.id ?? '', allowed)); break
      }
    }
    index = Math.min(index, history.present.blocks.length - 1)
    if (view === 'breakdown' && ['add-item', 'remove-item', 'remove-occurrence', 'add-occurrence', 'edit-item'].includes(command.op)) panel = breakdownPanel(history.present)
    caret = Math.min(caret, history.present.blocks[index].text.length)
    const current = history.present.blocks[index]
    return { title: history.present.meta.title, author: history.present.meta.author, dirty: JSON.stringify(history.present) !== saved,
      index, caret, type: current.type, text: current.text, blockCount: history.present.blocks.length,
      context: history.present.blocks.slice(Math.max(0, index - 3), index + 5).map(block => `${block.type.toUpperCase()}\n${block.text}`).join('\n\n'),
      scenes: extractScenes(history.present).map((scene, i) => `${i + 1}. ${scene.heading}`), message, view, panel }
  }
  return { dispatch }
}
