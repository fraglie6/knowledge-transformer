import { readdir, readFile } from 'node:fs/promises'

const methodsRoot = new URL('../knowledge-base/methods/', import.meta.url)
const fileNames = (await readdir(methodsRoot)).filter((name) => name.endsWith('.md'))

const requiredFields = ['name', 'description', 'whenToUse', 'tags', 'role']
const requiredSections = ['## 何时使用', '## 怎么做', '## 为什么', '## 例子']
let failed = false

for (const fileName of fileNames) {
  const text = await readFile(new URL(fileName, methodsRoot), 'utf8')
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  const frontmatter = {}

  if (match) {
    for (const line of match[1].split('\n')) {
      const index = line.indexOf(':')
      if (index === -1) continue
      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim()
      if (key) frontmatter[key] = value
    }
  }

  const missingFields = requiredFields.filter((field) => !frontmatter[field])
  const missingSections = requiredSections.filter((section) => !text.includes(section))

  if (missingFields.length > 0 || missingSections.length > 0) {
    failed = true
    console.error(`[invalid] ${fileName}`)
    if (missingFields.length > 0) {
      console.error(`  missing fields: ${missingFields.join(', ')}`)
    }
    if (missingSections.length > 0) {
      console.error(`  missing sections: ${missingSections.join(', ')}`)
    }
  }
}

if (failed) {
  process.exit(1)
}

console.log(`[method-library] ${fileNames.length} method notes are valid`)
