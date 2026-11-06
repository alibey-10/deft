import { cn } from 'cn'

import type { Author } from '#/lib/directory.ts'

const px = { sm: 20, md: 32, lg: 40 }
const sizeClass = { sm: 'size-5', md: 'size-8', lg: 'size-10' }

export function AuthorAvatar({
  author,
  size = 'md',
}: {
  author: Author
  size?: 'sm' | 'md' | 'lg'
}) {
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
