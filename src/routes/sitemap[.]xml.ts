import { createFileRoute } from '@tanstack/react-router'

import { api } from '../../convex/_generated/api'
import { buildDirectory } from '#/lib/directory.ts'
import { buildSitemapXml } from '#/lib/sitemap.ts'
import { getConvex } from '#/lib/skill-source.server.ts'

/** XML sitemap of every public page, built from the live directory on each request. */
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const data = await getConvex().query(api.directory.get, {})
        const xml = buildSitemapXml(buildDirectory(data), new URL(request.url).origin)
        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            // Crawlers fetch it rarely; an hour at the edge keeps Convex reads down.
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
