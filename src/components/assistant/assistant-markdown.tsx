import { Link } from '@tanstack/react-router'
import { defaultComponents, Streamdown, type Components } from 'streamdown'

import { SkillAvatar, skillPathFromHref } from '#/components/assistant/skill-avatar.tsx'

const linkClass = 'font-medium text-primary underline underline-offset-4'

const components: Components = {
  a: (props) => {
    const href = typeof props.href === 'string' ? props.href : ''
    // Skill links get the author's avatar, like a mention.
    const pathSlug = skillPathFromHref(href)
    if (pathSlug) {
      return (
        <Link
          to="/skills/$"
          params={{ _splat: pathSlug }}
          className="inline-flex items-center gap-1 align-bottom font-medium text-primary underline underline-offset-4"
        >
          <SkillAvatar pathSlug={pathSlug} />
          {props.children}
        </Link>
      )
    }
    // Other site paths stay in the SPA.
    if (href.startsWith('/') && !href.startsWith('//')) {
      return (
        <Link to={href} className={linkClass}>
          {props.children}
        </Link>
      )
    }
    const Base = defaultComponents.a
    return <Base {...props} />
  },
}

/** The assistant's answer, rendered as it streams. */
export function AssistantMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      components={components}
      linkSafety={{ enabled: false }}
      className="text-sm leading-relaxed"
    >
      {text}
    </Streamdown>
  )
}
