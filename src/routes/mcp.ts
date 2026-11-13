import { createFileRoute } from '@tanstack/react-router'

import {
  handleMcpMethodNotAllowed,
  handleMcpOptions,
  handleMcpPost,
} from '#/lib/mcp/handler.server.ts'

/** Public, read-only MCP server so agents and editors can search and read Deft's skills. */
export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpPost(request),
      GET: () => handleMcpMethodNotAllowed(),
      DELETE: () => handleMcpMethodNotAllowed(),
      OPTIONS: () => handleMcpOptions(),
    },
  },
})
