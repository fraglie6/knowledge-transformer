import { parseFrontmatter, parseList, stripFrontmatter } from './frontmatter.js'

export type NoteKind = '认知' | '方法' | '融合'

const requiredSections: Record<NoteKind, string[]> = {
  认知: ['## 摘要', '## 关键点'],
  方法: ['## 何时使用', '## 怎么做', '## 为什么', '## 例子'],
  融合: ['## 新视角', '## 核心 Idea', '## 为什么值得探索', '## 可验证方向'],
}

export function assertNote(text: string, kind: NoteKind): string {
  if (!text.trim()) {
    throw new Error('LLM 返回了空内容')
  }

  const frontmatter = parseFrontmatter(text)
  if (frontmatter.type !== kind) {
    throw new Error(`期望笔记类型为 ${kind}，实际为 ${frontmatter.type ?? '缺失'}`)
  }

  const body = stripFrontmatter(text)
  if (!body.split('\n').some((line) => line.startsWith('# '))) {
    throw new Error('笔记缺少一级标题')
  }

  const missing = requiredSections[kind].filter((section) => !body.includes(section))
  if (missing.length > 0) {
    throw new Error(`笔记缺少必要小节：${missing.join(', ')}`)
  }

  if (kind === '融合' && parseList(frontmatter.sources).length === 0) {
    throw new Error('融合笔记必须列出至少一个来源（sources）')
  }

  return text
}
