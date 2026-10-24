import * as React from 'react'
import * as T from '@radix-ui/react-tooltip'

export const TooltipProvider = T.Provider

export function Tip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="z-[100] max-w-64 rounded-xl bg-ink px-3 py-2 text-[12px] leading-snug text-white shadow-lg data-[state=delayed-open]:animate-pop">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
