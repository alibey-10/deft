import { Link } from '@tanstack/react-router'
import { code } from '@streamdown/code'
import { defaultComponents, Streamdown, type Components } from 'streamdown'

import { dirOf, nodeText, slugify } from '#/lib/skill-content.ts'
import type { RegistrySkill } from '#/lib/directory.ts'

const isRelative = (url: string) => !/^([a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(url)

const withAnchor = (Tag: 'h2' | 'h3' | 'h4') => {
  const Base = defaultComponents[Tag]
  const Heading: NonNullable<Components[typeof Tag]> = (props) => (
    <Base {...props} id={slugify(nodeText(props.children))} className="scroll-mt-20" />
  )
  return Heading
}

const headings = { h2: withAnchor('h2'), h3: withAnchor('h3'), h4: withAnchor('h4') }

/**
 * Renders skill markdown. Relative links to the skill's own reference files stay in-app;
 * other relative links and images resolve against the file's location on GitHub.
 */
export function SkillMarkdown({
  skill,
  markdown,
  sourceUrl,
}: {
  skill: RegistrySkill
  markdown: string
  /** Raw URL of the file being rendered, used to resolve relative paths. */
  sourceUrl: string
}) {
  const rawDir = dirOf(sourceUrl)
  const skillRawDir = dirOf(skill.rawUrl)
  const githubDir = dirOf(skill.githubUrl)
  const isGithub = skill.githubUrl.includes('github.com/') && skill.githubUrl.includes('/blob/')

  const resolve = (url: string, key: string) => {
    if (!isRelative(url)) return url
    const absoluteRaw = new URL(url, rawDir).toString()
    if (key === 'src' || !isGithub) return absoluteRaw
    // Map raw.githubusercontent.com paths back to github.com/blob for browsing.
    return absoluteRaw.startsWith(skillRawDir)
      ? githubDir + absoluteRaw.slice(skillRawDir.length)
      : absoluteRaw
  }

  const components: Components = {
    ...headings,
    a: (props) => {
      const href = typeof props.href === 'string' ? props.href : ''
      if (href.startsWith('#')) {
        return (
          <a href={href} className="font-medium text-primary underline underline-offset-4">
            {props.children}
          </a>
        )
      }
      const relative = href.startsWith(githubDir)
        ? href.slice(githubDir.length).split('#')[0]
        : null
      if (relative && (relative === 'SKILL.md' || skill.files?.includes(relative))) {
        return (
          <Link
            to="/skills/$"
            params={{ _splat: skill.pathSlug }}
            search={relative === 'SKILL.md' ? {} : { file: relative }}
            className="font-medium text-primary underline underline-offset-4"
          >
            {props.children}
          </Link>
        )
      }
      const Base = defaultComponents.a
      return <Base {...props} />
    },
  }

  return (
    <Streamdown
      mode="static"
      plugins={{ code }}
      components={components}
      urlTransform={(url, key) => resolve(url, key)}
      linkSafety={{ enabled: false }}
      codeBlockMaxHeight={0}
      tableMaxHeight={0}
    >
      {markdown}
    </Streamdown>
  )
}
