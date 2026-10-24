import * as React from 'react'
import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

/**
 * Centered modal on ≥sm, bottom sheet on phones. `side="right"` renders a drawer.
 */
export function DialogContent({
  title,
  description,
  children,
  className,
  side = 'center',
  hideClose,
  footer,
  ...props
}: Omit<React.ComponentProps<typeof D.Content>, 'title'> & {
  title: React.ReactNode
  description?: React.ReactNode
  side?: 'center' | 'right'
  hideClose?: boolean
  footer?: React.ReactNode
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[3px] data-[state=open]:animate-fade" />
      <D.Content
        {...props}
        className={cn(
          'fixed z-[70] flex flex-col bg-paper text-ink shadow-[var(--shadow-pop)] outline-none',
          side === 'center' &&
            'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[28px] data-[state=open]:animate-sheet sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-32px))] sm:max-h-[min(860px,calc(100dvh-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:data-[state=open]:animate-pop',
          side === 'right' && 'inset-y-0 right-0 w-full sm:inset-y-3 sm:right-3 sm:w-[min(480px,calc(100vw-24px))] sm:rounded-[28px] data-[state=open]:animate-drawer',
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 sm:pt-6">
          <div className="min-w-0">
            <D.Title className="font-display text-[22px] font-normal tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-[13.5px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>}
          </div>
          {!hideClose && (
            <D.Close className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="size-[18px]" />
            </D.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </D.Content>
    </D.Portal>
  )
}
