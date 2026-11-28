/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/) lets a page hand tools to an AI agent
 * running in the browser, such as a browser's built-in assistant or an extension. Deft registers
 * the same read-only tools as its `/mcp` server plus a few that drive the open tab.
 *
 * The API is still an Origin Trial, so everything here is feature-detected and typed locally.
 * The spec puts it on `document.modelContext`; earlier builds and polyfills use
 * `navigator.modelContext`, so both are checked.
 */

export type WebMcpToolResult = {
  content: { type: 'text'; text: string }[]
  structuredContent?: unknown
  isError?: boolean
}

export type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (input: Record<string, unknown>) => Promise<WebMcpToolResult>
}

type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown> | { unregister?: () => void } | undefined
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
  interface Navigator {
    modelContext?: ModelContext
  }
}

export function getModelContext(): ModelContext | undefined {
  if (typeof document === 'undefined') return undefined
  const mc = document.modelContext ?? navigator.modelContext
  return typeof mc?.registerTool === 'function' ? mc : undefined
}

/**
 * Registers `tools` and returns a function that unregisters them. Aborting the signal is how the
 * spec unregisters; older builds return an `{ unregister }` handle instead, so both are honored.
 */
export function registerWebMcpTools(mc: ModelContext, tools: WebMcpTool[]) {
  const controller = new AbortController()
  const handles: { unregister?: () => void }[] = []

  for (const tool of tools) {
    try {
      const handle = mc.registerTool(tool, { signal: controller.signal })
      if (handle instanceof Promise) {
        handle.catch((error: unknown) => {
          // Unregistered before it finished, e.g. React's dev-mode double mount. Not a failure.
          if (controller.signal.aborted) return
          console.warn(`WebMCP: ${tool.name} not registered`, error)
        })
      } else if (handle) {
        handles.push(handle)
      }
    } catch (error) {
      // e.g. a duplicate name left behind by a hot reload, or a permissions policy block.
      console.warn(`WebMCP: ${tool.name} not registered`, error)
    }
  }

  return () => {
    controller.abort()
    for (const handle of handles) {
      try {
        handle.unregister?.()
      } catch {
        // Already gone.
      }
    }
  }
}

export const textResult = (value: unknown, isError = false): WebMcpToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
  ...(typeof value === 'string' ? {} : { structuredContent: value }),
  ...(isError ? { isError } : {}),
})

type ServerTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
}

let rpcId = 0

async function mcpRequest<T>(method: string, params?: unknown): Promise<T> {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const body = (await response.json()) as { result?: T; error?: { message: string } }
  if (body.error) throw new Error(body.error.message)
  return body.result as T
}

/**
 * Mirrors the `/mcp` server's tools so the in-page and remote surfaces never drift apart: the
 * schemas come from `tools/list` and each call is forwarded to `tools/call` on this origin.
 */
export async function loadServerTools(): Promise<WebMcpTool[]> {
  const { tools } = await mcpRequest<{ tools: ServerTool[] }>('tools/list')
  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    // Skill files are third-party Markdown, so flag them as untrusted for the agent.
    annotations: { readOnlyHint: true, untrustedContentHint: t.name === 'get_skill' },
    execute: async (input) => {
      try {
        return await mcpRequest<WebMcpToolResult>('tools/call', { name: t.name, arguments: input })
      } catch (error) {
        return textResult(error instanceof Error ? error.message : 'The tool failed.', true)
      }
    },
  }))
}
