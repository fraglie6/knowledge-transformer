import { readdir, readFile, writeFile } from 'node:fs/promises'

const methodsRoot = new URL('../knowledge-base/methods/', import.meta.url)
const fileNames = (await readdir(methodsRoot)).filter(
  (name) => name.endsWith('.md') && name !== 'index.md',
)

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return {}

  const fields = {}
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (key) fields[key] = value
  }
  return fields
}

function parseList(value) {
  if (!value) return []
  return value
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const entries = []

for (const fileName of fileNames) {
  const text = await readFile(new URL(fileName, methodsRoot), 'utf8')
  const frontmatter = parseFrontmatter(text)
  entries.push({
    name: frontmatter.name ?? fileName.replace(/\.md$/, ''),
    file: fileName,
    description: frontmatter.description ?? '',
    whenToUse: frontmatter.whenToUse ?? '',
    tags: parseList(frontmatter.tags),
    role: frontmatter.role ?? 'generalist',
  })
}

const indexPath = new URL('index.json', methodsRoot)
await writeFile(indexPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
console.log(`[method-index] wrote ${entries.length} entries to ${indexPath.pathname}`)
