export type TextSegment = {
  text: string
  match: boolean
}

const DEFAULT_WINDOW_AFTER = 80
const DEFAULT_LEAD_CHARS = 36
const MIN_LEADING_SLICE = 10

const NON_ALNUM_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const NON_ALNUM_RUN = /[^\p{L}\p{N}]+/u
const ALNUM_START = /^[\p{L}\p{N}]/u

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function termPattern(term: string): string {
  const escaped = escapeRegExp(term)
  // Match at word starts so short queries like `ui` do not highlight inside `Quickly` or `build`.
  return ALNUM_START.test(term) ? `(?<![\\p{L}\\p{N}])${escaped}` : escaped
}

function parseQueryTokens(query: string): string[] {
  const seen = new Set<string>()
  const tokens: string[] = []

  for (const rawToken of query.trim().split(/\s+/)) {
    const token = rawToken.replace(NON_ALNUM_EDGE, '')
    if (!token) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(token)
  }

  return tokens
}

function extractTerms(text: string, query: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []

  const add = (term: string) => {
    const key = term.toLowerCase()
    if (!term || seen.has(key)) return
    seen.add(key)
    terms.push(term)
  }

  for (const token of parseQueryTokens(query)) {
    if (NON_ALNUM_RUN.test(token)) {
      if (new RegExp(termPattern(token), 'iu').test(text)) {
        add(token)
      } else {
        for (const part of token.split(NON_ALNUM_RUN)) add(part)
      }
    } else {
      add(token)
    }
  }

  return terms.sort((a, b) => b.length - a.length)
}

export type SearchableEntry = {
  value: string
  keywords?: string[]
  description?: string
}

type CompiledToken = {
  literal: RegExp
  parts?: RegExp[]
}

function scoreRegexInFields(
  regex: RegExp,
  value: string,
  keywordsText: string,
  description: string,
): number {
  const valueHit = regex.exec(value)
  if (valueHit) {
    return valueHit.index === 0 ? 4 : 3 + 0.5 / (1 + valueHit.index / 20)
  }

  if (keywordsText && regex.test(keywordsText)) {
    return 2
  }

  if (description) {
    const descHit = regex.exec(description)
    if (descHit) return 0.5 + 0.5 / (1 + descHit.index / 80)
  }

  return 0
}

function scoreToken(
  token: CompiledToken,
  value: string,
  keywordsText: string,
  description: string,
): number {
  const literalScore = scoreRegexInFields(token.literal, value, keywordsText, description)
  if (literalScore > 0) return literalScore

  if (!token.parts || token.parts.length === 0) return 0

  let partSum = 0
  for (const part of token.parts) {
    const partScore = scoreRegexInFields(part, value, keywordsText, description)
    if (partScore === 0) return 0
    partSum += partScore
  }
  return partSum / token.parts.length
}

/**
 * Compiles a word-start matcher for `query` across `value`, `keywords`, and `description`.
 * Requires every query token to match (no fuzzy subsequence matching) and ranks exact/prefix
 * value matches above mid-value, keyword, and description matches.
 */
export function createSearchMatcher(query: string): (entry: SearchableEntry) => number {
  const compiled: CompiledToken[] = parseQueryTokens(query).map((token) => ({
    literal: new RegExp(termPattern(token), 'iu'),
    parts: NON_ALNUM_RUN.test(token)
      ? token
          .split(NON_ALNUM_RUN)
          .filter(Boolean)
          .map((part) => new RegExp(termPattern(part), 'iu'))
      : undefined,
  }))

  if (compiled.length === 0) return () => 0

  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, ' ')

  return (entry: SearchableEntry) => {
    const keywordsText = entry.keywords?.join(' ') ?? ''
    const description = entry.description ?? ''

    let total = 0
    for (const token of compiled) {
      const score = scoreToken(token, entry.value, keywordsText, description)
      if (score === 0) return 0
      total += score
    }

    const avg = total / compiled.length
    const lowerValue = entry.value.toLowerCase()
    const bonus =
      lowerValue === normalizedQuery ? 10 : lowerValue.startsWith(normalizedQuery) ? 6 : 0

    return avg + bonus
  }
}

function findWindowStart(
  text: string,
  firstMatchStart: number,
  windowAfter: number,
  leadChars: number,
): number {
  if (firstMatchStart <= windowAfter) return 0

  const target = Math.max(0, firstMatchStart - leadChars)
  if (target <= MIN_LEADING_SLICE) return 0
  if (/\s/.test(text[target - 1] ?? '')) return target

  const spaceMatch = /\s+/.exec(text.slice(target, firstMatchStart))
  if (spaceMatch) {
    const nextWord = target + spaceMatch.index + spaceMatch[0].length
    if (nextWord <= firstMatchStart) return nextWord
  }

  return target
}

/**
 * Splits `text` into highlighted and plain segments for `query`. When the first match sits past
 * `windowAfter`, windows the returned text around that match with a leading `…` so clamped cards
 * keep the matched term visible.
 */
export function highlightDescription(
  text: string,
  query: string,
  options?: { windowAfter?: number; leadChars?: number },
): TextSegment[] {
  if (!text) return []
  if (!query.trim()) return [{ text, match: false }]

  const terms = extractTerms(text, query)
  if (terms.length === 0) return [{ text, match: false }]

  const pattern = new RegExp(terms.map(termPattern).join('|'), 'giu')
  const matches: Array<{ start: number; end: number }> = []
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined || match[0].length === 0) continue
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  if (matches.length === 0) return [{ text, match: false }]

  const windowAfter = options?.windowAfter ?? DEFAULT_WINDOW_AFTER
  const leadChars = options?.leadChars ?? DEFAULT_LEAD_CHARS
  const sliceStart = findWindowStart(text, matches[0].start, windowAfter, leadChars)

  const segments: TextSegment[] = []
  let cursor = sliceStart

  for (const match of matches) {
    if (match.start > cursor) {
      const prefix = cursor === sliceStart && sliceStart > 0 ? '…' : ''
      segments.push({ text: prefix + text.slice(cursor, match.start), match: false })
    } else if (cursor === sliceStart && sliceStart > 0) {
      segments.push({ text: '…', match: false })
    }
    segments.push({ text: text.slice(match.start, match.end), match: true })
    cursor = match.end
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false })
  }

  return segments
}
