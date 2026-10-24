import * as React from 'react'
import * as P from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close

export function PopoverContent({ className, align = 'end', ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn('z-[80] rounded-[22px] bg-paper/95 p-4 text-ink shadow-[var(--shadow-pop)] ring-1 ring-line backdrop-blur-xl outline-none data-[state=open]:animate-pop', className)}
        {...props}
      />
    </P.Portal>
  )
}
