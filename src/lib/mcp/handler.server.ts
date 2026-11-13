import { z } from 'zod'

import { mcpTools, ToolError, type McpToolName } from '#/lib/mcp/tools.server.ts'

/**
 * A minimal, stateless MCP server over Streamable HTTP. Each POST carries one JSON-RPC message
 * and gets a plain JSON response (no SSE, no sessions), which the spec allows and every major
 * client supports. No auth: the tools only read public directory data.
 */

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const LATEST_PROTOCOL = PROTOCOL_VERSIONS[0]

const SERVER_INFO = { name: 'deft', title: 'Deft', version: '1.0.0' }

const INSTRUCTIONS = `Deft is a directory of agent skills (SKILL.md files) for UI work: design, accessibility, motion, components and framework-specific practice.

- Call search_skills before recommending or naming a skill. Never invent skills, authors or links.
- Call get_skill to read what a skill says; follow its instructions when the user wants to apply it. Read its reference files with \`file\` when SKILL.md points to them.
- Use list_topics and browse_topic to explore by category.
- When recommending, link each skill's url and give its install command.`

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc: '2.0'; id?: JsonRpcId; method: string; params?: unknown }

const rpcResult = (id: JsonRpcId, result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
})

const toolList = Object.entries(mcpTools).map(([name, t]) => {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(t.input) as Record<string, unknown>
  return {
    name,
    title: t.title,
    description: t.description,
    inputSchema,
    annotations: { title: t.title, readOnlyHint: true, openWorldHint: false },
  }
})

const isRequest = (m: unknown): m is JsonRpcRequest =>
  typeof m === 'object' &&
  m !== null &&
  (m as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
  typeof (m as { method?: unknown }).method === 'string'

type CallOutcome = { error: string; result?: never } | { error?: never; result: unknown }

async function callTool(params: unknown, origin: string): Promise<CallOutcome> {
  const { name, arguments: args } = (params ?? {}) as { name?: unknown; arguments?: unknown }
  if (typeof name !== 'string' || !(name in mcpTools)) {
    return { error: `Unknown tool: ${String(name)}` }
  }
  const tool = mcpTools[name as McpToolName]
  const parsed = tool.input.safeParse(args ?? {})
  const fail = (text: string) => ({ result: { content: [{ type: 'text', text }], isError: true } })
  if (!parsed.success) return fail(`Invalid arguments: ${z.prettifyError(parsed.error)}`)
  try {
    const output = await (tool.handler as (a: unknown, c: { origin: string }) => Promise<unknown>)(
      parsed.data,
      { origin },
    )
    return {
      result: {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      },
    }
  } catch (error) {
    if (error instanceof ToolError) return fail(error.message)
    console.error(`MCP tool ${name} failed`, error)
    return fail('The tool failed unexpectedly. Try again shortly.')
  }
}

/** Handle one JSON-RPC message. Returns null for notifications, which get no response. */
async function handleMessage(message: unknown, origin: string) {
  if (!isRequest(message)) return rpcError(null, -32600, 'Invalid Request')
  const { id, method, params } = message
  if (id === undefined) return null // notification, e.g. notifications/initialized

  switch (method) {
    case 'initialize': {
      const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion
      const protocolVersion =
        typeof requested === 'string' && PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: toolList })
    case 'tools/call': {
      const { result, error } = await callTool(params, origin)
      return error ? rpcError(id, -32602, error) : rpcResult(id, result)
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } })

export async function handleMcpPost(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400)
  }
  const origin = new URL(request.url).origin

  // Batches were dropped in 2025-06-18 but older clients may still send them.
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleMessage(m, origin)))).filter(Boolean)
    return responses.length ? json(responses) : new Response(null, { status: 202, headers: CORS })
  }
  const response = await handleMessage(body, origin)
  return response ? json(response) : new Response(null, { status: 202, headers: CORS })
}

/** No server-initiated stream: GET (SSE) and DELETE (sessions) aren't supported. */
export const handleMcpMethodNotAllowed = () =>
  new Response('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })

export const handleMcpOptions = () => new Response(null, { status: 204, headers: CORS })
