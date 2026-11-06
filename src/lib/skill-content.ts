import type { ReactNode } from 'react'
import { isValidElement } from 'react'

export type TocEntry = { id: string; text: string; depth: number }

export type ParsedSkill = {
  /** Scalar frontmatter fields, e.g. name, description, license. */
  frontmatter: Record<string, string>
  body: string
  toc: TocEntry[]
}

/** GitHub-style heading slug. Must match for TOC entries and rendered headings. */
export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** Plain text of rendered React children, used to derive heading ids. */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

/** Strip inline markdown so heading text matches what the renderer outputs. */
function inlineText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

function parseFrontmatter(source: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return { frontmatter: {}, body: source }

  const frontmatter: Record<string, string> = {}
  let currentKey: string | null = null
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (pair) {
      currentKey = pair[1]
      const value = pair[2].replace(/^[>|][-+]?$/, '').replace(/^(['"])(.*)\1$/, '$2')
      frontmatter[currentKey] = value
    } else if (currentKey && /^\s+\S/.test(line)) {
      // Folded/indented continuation of the previous value.
      frontmatter[currentKey] = `${frontmatter[currentKey]} ${line.trim()}`.trim()
    } else {
      currentKey = null
    }
  }
  return { frontmatter, body: source.slice(match[0].length) }
}

function extractToc(body: string): TocEntry[] {
  const toc: TocEntry[] = []
  let fence: string | null = null
  for (const line of body.split(/\r?\n/)) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0]
      else if (fenceMatch[1][0] === fence) fence = null
      continue
    }
    if (fence) continue
    const heading = /^\s{0,3}(#{2,4})\s+(.+)$/.exec(line)
    if (!heading) continue
    const text = inlineText(heading[2])
    if (text) toc.push({ id: slugify(text), text, depth: heading[1].length })
  }
  return toc
}

export function parseSkill(source: string): ParsedSkill {
  const { frontmatter, body } = parseFrontmatter(source)
  return { frontmatter, body, toc: extractToc(body) }
}

/** Directory URL (with trailing slash) that relative paths in a file resolve against. */
export const dirOf = (url: string) => url.slice(0, url.lastIndexOf('/') + 1)
