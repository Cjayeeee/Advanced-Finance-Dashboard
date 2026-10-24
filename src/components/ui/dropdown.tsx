import * as React from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const Dropdown = DM.Root
export const DropdownTrigger = DM.Trigger
export const DropdownSeparator = (p: React.ComponentProps<typeof DM.Separator>) => <DM.Separator className="my-1 h-px bg-line" {...p} />
export const DropdownLabel = ({ className, ...p }: React.ComponentProps<typeof DM.Label>) => <DM.Label className={cn('px-3 pt-2 pb-1 eyebrow', className)} {...p} />

export function DropdownContent({ className, align = 'end', ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={8}
        className={cn('z-[80] min-w-48 rounded-2xl bg-paper/95 p-1.5 text-ink shadow-[var(--shadow-pop)] ring-1 ring-line backdrop-blur-xl data-[state=open]:animate-pop', className)}
        {...props}
      />
    </DM.Portal>
  )
}

export function DropdownItem({ className, destructive, ...props }: React.ComponentProps<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink-3 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-ink/5 data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:text-muted',
        destructive && 'text-loss data-[highlighted]:bg-loss-soft data-[highlighted]:text-loss [&_svg]:text-loss',
        className,
      )}
      {...props}
    />
  )
}
