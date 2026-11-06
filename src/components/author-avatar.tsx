import { cn } from 'cn'

import type { Author } from '#/lib/directory.ts'

const px = { xs: 16, sm: 20, base: 24, md: 32, lg: 40 }
const sizeClass = { xs: 'size-4', sm: 'size-5', base: 'size-6', md: 'size-8', lg: 'size-10' }

export function AuthorAvatar({ author, size = 'md' }: { author: Author; size?: keyof typeof px }) {
  return (
    <img
      src={author.avatarUrl}
      alt=""
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden'
      }}
      width={px[size]}
      height={px[size]}
      className={cn(
        'shrink-0 rounded-full bg-muted outline outline-1 -outline-offset-1 outline-foreground/10',
        sizeClass[size],
      )}
    />
  )
}
