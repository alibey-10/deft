import { Link } from '@tanstack/react-router'
import { defaultComponents, Streamdown, type Components } from 'streamdown'

import { SkillAvatar, skillPathFromHref } from '#/components/assistant/skill-avatar.tsx'
import { SkillLink } from '#/components/assistant/skill-hover-card.tsx'

const linkClass = 'font-medium text-primary underline underline-offset-4'

const components: Components = {
  a: (props) => {
    const href = typeof props.href === 'string' ? props.href : ''
    // Skill links get the author's avatar, like a mention, and preview the skill on hover.
    const pathSlug = skillPathFromHref(href)
    if (pathSlug) {
      return (
        <SkillLink
          pathSlug={pathSlug}
          className="inline-flex items-center gap-1 align-bottom font-medium text-primary underline underline-offset-4"
        >
          <SkillAvatar pathSlug={pathSlug} />
          {props.children}
        </SkillLink>
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
  // `data-slot` scopes the answer's theme in styles.css.
  return (
    <div data-slot="assistant-answer">
      <Streamdown
        mode={streaming ? 'streaming' : 'static'}
        isAnimating={streaming}
        components={components}
        linkSafety={{ enabled: false }}
        className="text-[0.9375rem] leading-[1.65]"
      >
        {text}
      </Streamdown>
    </div>
  )
}
