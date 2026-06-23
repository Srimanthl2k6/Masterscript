import { describe, expect, it } from 'vitest'
import {
  exportProjectToDocx,
  exportProjectToFdx,
  exportProjectToPdf,
  importFountainProject,
  importDocxProject,
  importFdxProject,
} from './adapters'
import { createBlock, createEmptyProject } from './screenplay'

describe('fdx adapter scaffold', () => {
  it('parses basic FDX paragraphs into screenplay blocks', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. CAFE - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>A crowded lunch rush fills the room.</Text></Paragraph>
    <Paragraph Type="Character"><Text>MAYA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>We only get one shot at this.</Text></Paragraph>
  </Content>
</FinalDraft>`

    const result = importFdxProject(source)

    expect(result.warnings).toHaveLength(0)
    expect(result.data.blocks).toHaveLength(4)
    expect(result.data.blocks[0].type).toBe('scene-heading')
    expect(result.data.blocks[2].type).toBe('character')
  })

  it('exports screenplay blocks into Final Draft XML', () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. CAFE - DAY'),
      createBlock('action', 'A crowded lunch rush fills the room.'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'We only get one shot at this.'),
    ]

    const exported = exportProjectToFdx(project)

    expect(exported).toContain('<FinalDraft')
    expect(exported).toContain('Paragraph Type="Scene Heading"')
    expect(exported).toContain('<Text>MAYA</Text>')
  })

  it('round-trips FDX formatting runs', () => {
    const project = createEmptyProject()
    const action = createBlock('action', 'Mixed style')
    action.formatRanges = [
      {
        start: 0,
        end: 5,
        format: { bold: true, underline: true, fontFamily: 'Inter' },
      },
    ]
    project.blocks = [action]

    const exported = exportProjectToFdx(project)
    const imported = importFdxProject(exported)

    expect(exported).toContain('Style="Bold+Underline"')
    expect(exported).toContain('Font="Inter"')
    expect(
      imported.data.blocks.find((block) => block.text === action.text)?.formatRanges,
    ).toEqual(action.formatRanges)
  })
})

describe('docx adapter scaffold', () => {
  it('exports and re-imports DOCX content', async () => {
    const project = createEmptyProject()
    project.blocks = [
      createBlock('scene-heading', 'INT. WAREHOUSE - NIGHT'),
      createBlock('action', 'Sparks fall from a damaged light rig.'),
      createBlock('character', 'JONAH'),
      createBlock('dialogue', 'We move before sunrise.'),
    ]

    const binary = await exportProjectToDocx(project)
    const imported = await importDocxProject(binary)

    expect(binary.byteLength).toBeGreaterThan(0)
    expect(imported.data.blocks.length).toBeGreaterThan(0)
    expect(imported.data.blocks.some((block) => block.type === 'scene-heading')).toBe(true)
  })
})

describe('pdf adapter scaffold', () => {
  it('exports screenplay content as valid PDF bytes', async () => {
    const project = createEmptyProject()
    project.meta.title = 'PDF Export Test'
    project.blocks = [
      createBlock('scene-heading', 'INT. SAFE HOUSE - NIGHT'),
      createBlock('action', 'Rain rattles against the skylight.'),
      createBlock('character', 'MAYA'),
      createBlock('dialogue', 'The package is gone.'),
    ]

    const binary = await exportProjectToPdf(project)
    const bytes = new Uint8Array(binary)
    const header = String.fromCharCode(...bytes.slice(0, 5))

    expect(binary.byteLength).toBeGreaterThan(200)
    expect(header).toBe('%PDF-')
  })

  it('exports long scripts with title-page metadata and pagination enabled', async () => {
    const project = createEmptyProject()
    project.meta.title = 'Operation Aurora'
    project.meta.author = 'Maya Chen'
    project.meta.contact = 'maya@example.com'
    project.meta.credits = 'Story by'
    project.meta.draftDate = '2026-04-13'
    project.meta.titlePageNotes = 'Confidential draft for internal review only.'
    project.meta.includeTitlePage = true
    project.meta.showPageNumbers = true
    project.meta.showSceneNumbers = true

    project.blocks = [
      createBlock('scene-heading', 'INT. BRIEFING ROOM - NIGHT'),
      createBlock(
        'action',
        Array.from({ length: 1200 }, (_, index) => `sequence-${index}`).join(' '),
      ),
      createBlock('character', 'MAYA'),
      createBlock(
        'dialogue',
        Array.from({ length: 420 }, () => 'We are not leaving this unresolved.').join(' '),
      ),
    ]

    const binary = await exportProjectToPdf(project)
    const bytes = new Uint8Array(binary)
    const header = String.fromCharCode(...bytes.slice(0, 5))

    expect(header).toBe('%PDF-')
    expect(binary.byteLength).toBeGreaterThan(1500)
  })

  it('supports unicode content when exporting PDF', async () => {
    const project = createEmptyProject()
    project.meta.includeTitlePage = false
    project.blocks = [
      createBlock('scene-heading', 'INT. KITCHEN - DAWN'),
      createBlock('action', 'Steam rises from caf\u00e9 cups near the window.'),
      createBlock('character', 'REN\u00c9E'),
      createBlock('dialogue', 'Na\u00efve plans fail fast; resilient plans survive.'),
    ]

    const binary = await exportProjectToPdf(project)
    const header = String.fromCharCode(...new Uint8Array(binary).slice(0, 5))

    expect(header).toBe('%PDF-')
    expect(binary.byteLength).toBeGreaterThan(300)
  })
})

describe('fountain adapter', () => {
  it('imports fountain screenplay into typed screenplay blocks', () => {
    const source = `Title: Into The White
Author: A. Writer
Draft Date: 2026-04-13

INT. APARTMENT - NIGHT

MAYA
(quietly)
I can hear the rain again.

[[Door rattles twice.]]

CUT TO:
`

    const parsed = importFountainProject(source)

    expect(parsed.data.meta.title).toBe('Into The White')
    expect(parsed.data.meta.author).toBe('A. Writer')
    expect(parsed.data.meta.draftDate).toBe('2026-04-13')
    expect(parsed.data.blocks.some((block) => block.type === 'scene-heading')).toBe(true)
    expect(parsed.data.blocks.some((block) => block.type === 'character')).toBe(true)
    expect(parsed.data.blocks.some((block) => block.type === 'dialogue')).toBe(true)
    expect(parsed.data.blocks.some((block) => block.type === 'note')).toBe(true)
    expect(parsed.data.blocks.some((block) => block.type === 'transition')).toBe(true)
  })

  it('imports sections and boneyard safely with warnings', () => {
    const source = `# ACT I
/* Hidden production note */
INT. ROOFTOP - DAWN

RAY
This is the clean copy.
`

    const parsed = importFountainProject(source)

    expect(parsed.data.blocks[0].type).toBe('note')
    expect(parsed.data.blocks.some((block) => block.type === 'scene-heading')).toBe(true)
    expect(parsed.warnings.length).toBeGreaterThan(0)
  })
})
