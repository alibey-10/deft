/**
 * Page content with a right-hand aside from `xl` up. Below that the aside is hidden; an empty one
 * is also hidden from assistive tech, so it doesn't announce a blank landmark.
 */
export function PageWithAside({
  children,
  aside,
  asideLabel,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
  asideLabel?: string
}) {
  return (
    <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex min-w-0 flex-col">{children}</div>
      <aside
        aria-label={aside ? asideLabel : undefined}
        aria-hidden={aside ? undefined : true}
        className="hidden self-start xl:sticky xl:top-14 xl:block"
      >
        {aside}
      </aside>
    </div>
  )
}
