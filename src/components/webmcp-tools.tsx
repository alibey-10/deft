import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'

import { topics } from '#/data/topics.ts'
import { getTopic, useDirectory } from '#/lib/directory.ts'
import {
  getModelContext,
  loadServerTools,
  registerWebMcpTools,
  textResult,
  type WebMcpTool,
} from '#/lib/webmcp.ts'

const str = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * Registers Deft's WebMCP tools for agents running in the visitor's browser. Renders nothing and
 * does no work at all unless the browser exposes `modelContext`.
 */
export function WebMcpTools() {
  const router = useRouter()
  const directory = useDirectory()
  // Tools are registered once; read the latest directory through a ref instead of re-registering.
  const directoryRef = useRef(directory)
  directoryRef.current = directory

  useEffect(() => {
    const mc = getModelContext()
    if (!mc) return

    const pageTools: WebMcpTool[] = [
      {
        name: 'get_current_page',
        title: 'Read the current page',
        description:
          'Get the Deft page the user has open: its URL, title, and the skill, topic or author it shows. Call this when the user says "this skill" or "this page".',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: async () => {
          const { pathname, search } = router.state.location
          const [, section, ...rest] = pathname.split('/')
          const slug = decodeURIComponent(rest.join('/'))
          const skill = section === 'skills' ? directoryRef.current.getSkill(slug) : undefined
          return textResult({
            url: `${location.origin}${pathname}`,
            title: document.title,
            ...(skill && {
              skill: { pathSlug: skill.pathSlug, name: skill.name, author: skill.user },
              file: (search as { file?: string }).file ?? 'SKILL.md',
            }),
            ...(section === 'topics' && slug && { topic: slug }),
            ...(section === 'authors' && slug && { author: slug }),
          })
        },
      },
      {
        name: 'open_skill',
        title: 'Open a skill',
        description:
          "Show a skill's page in this tab so the user can read it and copy its install command. Get the pathSlug from search_skills first.",
        inputSchema: {
          type: 'object',
          properties: {
            pathSlug: {
              type: 'string',
              description:
                'The pathSlug from search_skills, e.g. "vercel-labs/web-design-guidelines".',
            },
            file: {
              type: 'string',
              description: "A reference file from get_skill's `files` list. Omit for SKILL.md.",
            },
          },
          required: ['pathSlug'],
        },
        execute: async (input) => {
          const skill = directoryRef.current.getSkill(str(input.pathSlug))
          if (!skill) {
            return textResult(
              `No skill "${str(input.pathSlug)}". Use search_skills to find it.`,
              true,
            )
          }
          const file = typeof input.file === 'string' && input.file ? input.file : undefined
          if (file && !skill.files?.includes(file)) {
            return textResult(`"${file}" is not one of this skill's files.`, true)
          }
          await router.navigate({
            to: '/skills/$',
            params: { _splat: skill.pathSlug },
            search: file ? { file } : {},
          })
          return textResult(`Opened ${skill.name} by ${skill.user}.`)
        },
      },
      {
        name: 'open_topic',
        title: 'Open a topic',
        description: 'Show the list of skills in one topic in this tab.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              enum: topics.map((t) => t.slug),
              description: 'Topic slug.',
            },
          },
          required: ['topic'],
        },
        execute: async (input) => {
          const topic = getTopic(str(input.topic))
          if (!topic) return textResult(`Unknown topic "${str(input.topic)}".`, true)
          await router.navigate({ to: '/topics/$topic', params: { topic: topic.slug } })
          return textResult(`Opened the ${topic.label} topic.`)
        },
      },
    ]

    let unregister = registerWebMcpTools(mc, pageTools)
    let cancelled = false

    loadServerTools()
      .then((serverTools) => {
        if (cancelled) return
        const unregisterServer = registerWebMcpTools(mc, serverTools)
        const unregisterPage = unregister
        unregister = () => {
          unregisterPage()
          unregisterServer()
        }
      })
      .catch((error: unknown) => console.warn('WebMCP: could not load Deft tools', error))

    return () => {
      cancelled = true
      unregister()
    }
  }, [router])

  return null
}
