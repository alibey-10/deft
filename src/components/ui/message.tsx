import * as React from 'react'
import { cn } from 'cn'

function MessageGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = 'start',
  ...props
}: React.ComponentProps<'div'> & { align?: 'start' | 'end' }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        'group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse',
        className,
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        'flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8',
        className,
      )}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        'flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end',
        className,
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        'flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * With `reveal`, the footer stays hidden until the message is hovered or the footer holds focus,
 * and is always shown on devices without hover (touch). `data-pinned` keeps it shown, e.g. while
 * a "Copied" confirmation is on screen.
 */
function MessageFooter({
  className,
  reveal = false,
  ...props
}: React.ComponentProps<'div'> & { reveal?: boolean }) {
  return (
    <div
      data-slot="message-footer"
      data-reveal={reveal || undefined}
      className={cn(
        'flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end',
        // Revealed footers hold icon buttons, which bring their own padding: sit flush with the bubble.
        'data-reveal:-mt-1 data-reveal:px-0 data-reveal:opacity-0 data-reveal:transition-opacity data-reveal:group-hover/message:opacity-100 data-reveal:focus-within:opacity-100 data-reveal:data-pinned:opacity-100 data-reveal:[@media(hover:none)]:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader }
