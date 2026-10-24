import * as React from 'react'
import * as A from '@radix-ui/react-alert-dialog'
import { buttonVariants } from './button'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  children?: React.ReactNode
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[90] bg-ink/30 backdrop-blur-[3px] data-[state=open]:animate-fade" />
        <A.Content className="fixed left-1/2 top-1/2 z-[95] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[26px] bg-paper p-6 shadow-[var(--shadow-pop)] data-[state=open]:animate-pop">
          <A.Title className="font-display text-xl font-normal tracking-tight">{title}</A.Title>
          {description && <A.Description className="mt-2 text-[13.5px] leading-relaxed text-muted">{description}</A.Description>}
          {children}
          <div className="mt-6 flex justify-end gap-2">
            <A.Cancel className={buttonVariants({ variant: 'ghost' })}>Cancel</A.Cancel>
            <A.Action className={cn(buttonVariants({ variant: destructive ? 'danger' : 'primary' }))} onClick={onConfirm}>
              {confirmLabel}
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  )
}
