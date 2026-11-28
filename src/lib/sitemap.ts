import type { Directory } from '#/lib/directory.ts'

/** Public pages that don't depend on directory data. Admin, API and MCP routes stay out. */
const STATIC_PATHS = ['/', '/topics', '/authors', '/ask', '/docs/mcp']
/** Static pages that list skills, so they change whenever one is added. */
const LISTING_PATHS = new Set(['/', '/topics', '/authors'])

const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  )

const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

type Entry = { path: string; lastmod?: number }

/** Every indexable page: static pages, topics with skills, authors, skills and their extra files. */
export function sitemapEntries(directory: Directory): Entry[] {
  const newest = (skills: { addedAt: number }[]) => Math.max(...skills.map((s) => s.addedAt))
  const latest = directory.allSkills.length > 0 ? newest(directory.allSkills) : undefined

  // Listing pages change when a skill joins them. Skill pages get no lastmod: their content lives
  // on GitHub and can change without the directory knowing.
  const entries: Entry[] = STATIC_PATHS.map((path) => ({
    path,
    lastmod: LISTING_PATHS.has(path) ? latest : undefined,
  }))

  for (const topic of directory.topicsWithSkills) {
    const skills = directory.skillsByTopic.get(topic.slug) ?? []
    entries.push({ path: `/topics/${topic.slug}`, lastmod: newest(skills) })
  }
  for (const author of directory.authors) {
    entries.push({ path: `/authors/${author.key}`, lastmod: newest(author.skills) })
  }
  for (const skill of directory.allSkills) {
    entries.push({ path: `/skills/${skill.pathSlug}` })
    for (const file of skill.files ?? []) {
      entries.push({ path: `/skills/${skill.pathSlug}?file=${encodeURIComponent(file)}` })
    }
  }
  return entries
}

/** A sitemaps.org `urlset` for the directory, with absolute URLs on `origin`. */
export function buildSitemapXml(directory: Directory, origin: string): string {
  const urls = sitemapEntries(directory).map(({ path, lastmod }) => {
    const loc = `  <url><loc>${escapeXml(new URL(path, origin).toString())}</loc>`
    return lastmod === undefined
      ? `${loc}</url>`
      : `${loc}<lastmod>${toDate(lastmod)}</lastmod></url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
