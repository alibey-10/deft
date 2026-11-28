# lite-starter

TanStack Start, Tailwind CSS, and shadcn/ui on Cloudflare Workers.

```bash
bun install
bun run dev        # http://localhost:3000
bun run build
bun run deploy
```

Add a shadcn component:

```bash
pnpm dlx shadcn@latest add button
```

## MCP server

The site serves a public, read-only MCP server at `/mcp` (Streamable HTTP, no auth), so any agent
or editor can search and read Deft's skills. Tools: `search_skills`, `get_skill`, `list_topics`,
`browse_topic`. Code lives in `src/lib/mcp/`.

```bash
# Claude Code
claude mcp add --transport http deft https://<your-domain>/mcp
```

Cursor / VS Code / Windsurf (`mcp.json`):

```json
{ "mcpServers": { "deft": { "url": "https://<your-domain>/mcp" } } }
```

Locally, use `http://localhost:3000/mcp` while `bun run dev` is running. Inspect it with
`npx @modelcontextprotocol/inspector`.

### WebMCP

Every page also registers the same tools in the browser through [WebMCP](https://webmachinelearning.github.io/webmcp/)
(`document.modelContext`, falling back to `navigator.modelContext`), plus `get_current_page`,
`open_skill` and `open_topic` to drive the open tab. The schemas come from `/mcp`'s `tools/list`
and calls are forwarded to `tools/call`, so both surfaces stay in sync. Code lives in
`src/lib/webmcp.ts` and `src/components/webmcp-tools.tsx`; it does nothing when the API is missing.
