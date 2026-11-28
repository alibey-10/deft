import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'

import { CodeBlock } from '#/components/code-block.tsx'
import { InstallCommand } from '#/components/install-command.tsx'
import { PageIntro } from '#/components/site-header.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs.tsx'

/** The MCP endpoint on whichever host served this page (prod, preview or localhost). */
const getMcpUrl = createServerFn({ method: 'GET' }).handler(() =>
  new URL('/mcp', getRequestUrl()).toString(),
)

export const Route = createFileRoute('/docs/mcp')({
  head: () => ({
    meta: [
      { title: 'MCP · Deft' },
      {
        name: 'description',
        content:
          'Connect Claude, Cursor, VS Code, Codex or any MCP client to Deft’s skills directory.',
      },
    ],
  }),
  loader: async () => ({ url: await getMcpUrl() }),
  component: McpPage,
})

const SERVER = 'deft'

const prompts = [
  'Find a Deft skill for accessible form validation and summarize what it checks.',
  'Which Deft skills cover React animation? Compare the top three.',
  'Read the Deft skill for web design guidelines and review this page against it.',
]

const tools = [
  {
    name: 'search_skills',
    description: 'Full-text search across skill names, descriptions, authors, repos and topics.',
  },
  {
    name: 'get_skill',
    description:
      'Reads a skill’s SKILL.md, or one of its reference files, plus its install command.',
  },
  { name: 'list_topics', description: 'Lists the topics skills are grouped under.' },
  { name: 'browse_topic', description: 'Lists the skills in one topic, most-starred first.' },
]

const browserTools = [
  {
    name: 'get_current_page',
    description: 'Says which skill, topic or author the user has open.',
  },
  { name: 'open_skill', description: 'Opens a skill’s page, or one of its reference files.' },
  { name: 'open_topic', description: 'Opens the list of skills in a topic.' },
]

function McpPage() {
  const { url } = Route.useLoaderData()

  return (
    <article className="flex max-w-3xl flex-col">
      <PageIntro
        eyebrow="Docs"
        title="Deft MCP"
        description={
          <>
            Let your coding agent search and read every skill in Deft through the{' '}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-redline/60 underline-offset-4 hover:decoration-redline"
            >
              Model Context Protocol
            </a>
            . It’s free and read-only, with no account or API key.
          </>
        }
      >
        <div className="flex max-w-xl flex-col gap-2 pt-3">
          <span className="text-sm font-medium">Server URL</span>
          <UrlField url={url} />
        </div>
      </PageIntro>

      <div className="flex flex-col gap-14">
        <Step number={1} title="Connect your client">
          <ClientTabs url={url} />
        </Step>

        <Step number={2} title="Ask about skills">
          <p className="text-muted-foreground">
            Mention Deft so the agent reaches for these tools. For example:
          </p>
          <ul className="flex flex-col gap-2">
            {prompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded-lg border bg-muted/40 px-4 py-3 text-[0.9375rem] leading-relaxed"
              >
                “{prompt}”
              </li>
            ))}
          </ul>
        </Step>

        <Section title="How it works">
          <p className="text-muted-foreground">
            Deft is a directory, not a host: each skill lives in its author’s GitHub repo. The agent
            searches the directory, reads the SKILL.md it needs straight from the source, and when
            you want to keep one, installs it with the same command shown on every{' '}
            <Link
              to="/"
              className="text-foreground underline decoration-redline/60 underline-offset-4 hover:decoration-redline"
            >
              skill page
            </Link>
            :
          </p>
          <InstallCommand command="npx skills add https://github.com/<user>/<repo> --skill <name>" />
        </Section>

        <Section title="In the browser (WebMCP)">
          <p className="text-muted-foreground">
            Every Deft page also registers these tools with{' '}
            <a
              href="https://webmachinelearning.github.io/webmcp/"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-redline/60 underline-offset-4 hover:decoration-redline"
            >
              WebMCP
            </a>
            , so an agent built into your browser can use them on the open tab with nothing to
            install. It adds three that drive the tab:
          </p>
          <ToolList tools={browserTools} />
          <Note>
            WebMCP is experimental. Browsers without it skip this step and the site works as usual.
          </Note>
        </Section>

        <Section title="Tools">
          <ToolList tools={tools} />
        </Section>
      </div>
    </article>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-[1.3125rem] font-semibold tracking-[-0.015em] [font-stretch:92%]">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full border border-redline/40 font-mono text-sm text-redline"
        >
          {number}
        </span>
        <span>
          <span className="sr-only">Step {number}: </span>
          {title}
        </span>
      </h2>
      {children}
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[1.3125rem] font-semibold tracking-[-0.015em] [font-stretch:92%]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function UrlField({ url }: { url: string }) {
  return <InstallCommand command={url} prompt="" copyLabel="Copy server URL" />
}

/** A link styled as a button that opens a client's install flow. */
function InstallLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={buttonVariants({ variant: 'outline', className: 'w-fit' })}>
      {children}
      <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon="inline-end" aria-hidden />
    </a>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function ClientTabs({ url }: { url: string }) {
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER}&config=${btoa(
    JSON.stringify({ url }),
  )}`
  const vscodeConfig = JSON.stringify({ name: SERVER, type: 'http', url })
  const vscodeLink = `vscode:mcp/install?${encodeURIComponent(vscodeConfig)}`
  const mcpServers = (key: 'url' | 'serverUrl') =>
    JSON.stringify({ mcpServers: { [SERVER]: { [key]: url } } }, null, 2)

  const clients = [
    {
      id: 'claude-code',
      label: 'Claude Code',
      body: (
        <>
          <InstallCommand command={`claude mcp add --transport http ${SERVER} ${url}`} />
          <Note>
            Add <Code>--scope user</Code> to use it in every project. Run <Code>/mcp</Code> in
            Claude Code to check the connection.
          </Note>
        </>
      ),
    },
    {
      id: 'cursor',
      label: 'Cursor',
      body: (
        <>
          <InstallLink href={cursorLink}>Add to Cursor</InstallLink>
          <Note>
            Or add it to <Code>~/.cursor/mcp.json</Code> (or <Code>.cursor/mcp.json</Code> to share
            it with a project):
          </Note>
          <CodeBlock label="~/.cursor/mcp.json" code={mcpServers('url')} />
          <Note>
            Check it’s switched on in{' '}
            <strong className="text-foreground">Cursor Settings → MCP</strong>.
          </Note>
        </>
      ),
    },
    {
      id: 'vscode',
      label: 'VS Code',
      body: (
        <>
          <InstallLink href={vscodeLink}>Install in VS Code</InstallLink>
          <Note>Or from a terminal:</Note>
          <InstallCommand command={`code --add-mcp '${vscodeConfig}'`} />
          <Note>
            The tools show up in Copilot Chat’s Agent mode. For one workspace, add it under{' '}
            <Code>servers</Code> in <Code>.vscode/mcp.json</Code>.
          </Note>
        </>
      ),
    },
    {
      id: 'codex',
      label: 'Codex',
      body: (
        <>
          <InstallCommand command={`codex mcp add ${SERVER} --url ${url}`} />
          <Note>
            Or add it to <Code>~/.codex/config.toml</Code>, then run <Code>/mcp</Code> in Codex to
            check it:
          </Note>
          <CodeBlock
            label="~/.codex/config.toml"
            code={`[mcp_servers.${SERVER}]\nurl = "${url}"`}
          />
        </>
      ),
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      body: (
        <>
          <CodeBlock label="~/.codeium/windsurf/mcp_config.json" code={mcpServers('serverUrl')} />
          <Note>
            Windsurf uses <Code>serverUrl</Code>, not <Code>url</Code>. Open the MCPs icon in
            Cascade, choose Configure, save, then refresh.
          </Note>
        </>
      ),
    },
    {
      id: 'claude',
      label: 'Claude app',
      body: (
        <>
          <Note>
            In claude.ai or Claude Desktop, go to{' '}
            <strong className="text-foreground">
              Settings → Connectors → Add custom connector
            </strong>
            , name it <Code>Deft</Code> and paste the server URL. On Team and Enterprise plans an
            owner may need to add it first.
          </Note>
          <UrlField url={url} />
        </>
      ),
    },
    {
      id: 'other',
      label: 'Other',
      body: (
        <>
          <Note>
            Any client that supports remote MCP servers over Streamable HTTP can connect. No headers
            or auth are needed.
          </Note>
          <UrlField url={url} />
        </>
      ),
    },
  ]

  return (
    <Tabs defaultValue="claude-code">
      <TabsList
        variant="ghost"
        className="w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto"
      >
        {clients.map((client) => (
          <TabsTrigger key={client.id} value={client.id} className="flex-none">
            {client.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {clients.map((client) => (
        <TabsContent key={client.id} value={client.id} className="flex flex-col gap-3 pt-3">
          {client.body}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  )
}

function ToolList({ tools }: { tools: { name: string; description: string }[] }) {
  return (
    <dl className="flex flex-col">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="grid gap-1 border-t py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6"
        >
          <dt>
            <code className="font-mono text-sm font-medium">{tool.name}</code>
          </dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">{tool.description}</dd>
        </div>
      ))}
    </dl>
  )
}
