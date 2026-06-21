import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBenchmarkProject } from '../../src/lib/benchmarkFixtures'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..', '..')
const fixtureDirectory = path.join(
  repositoryRoot,
  'analysis',
  'tauri-pass1',
  'fixtures',
)

const fixtures = [
  { name: 'small', pages: 5 },
  { name: 'medium', pages: 50 },
  { name: 'large-200-page', pages: 200 },
]

await mkdir(fixtureDirectory, { recursive: true })

for (const fixture of fixtures) {
  const project = createBenchmarkProject(fixture.pages)
  const fixturePath = path.join(fixtureDirectory, `${fixture.name}.msproj.json`)
  await writeFile(fixturePath, `${JSON.stringify(project, null, 2)}\n`, 'utf8')
  console.log(`${fixture.name}: ${project.blocks.length} blocks -> ${fixturePath}`)
}
