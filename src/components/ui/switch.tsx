import * as React from 'react'
import * as Sw from '@radix-ui/react-switch'
import * as Cb from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn('relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-ink/15 transition-colors duration-200 data-[state=checked]:bg-ink disabled:opacity-40', className)}
      {...props}
    >
      <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-sun" />
    </Sw.Root>
  )
}

export function Checkbox({ className, checked, ...props }: React.ComponentProps<typeof Cb.Root>) {
  return (
    <Cb.Root
      checked={checked}
      className={cn('grid size-[18px] shrink-0 place-items-center rounded-[6px] bg-white ring-1 ring-line-strong transition-colors data-[state=checked]:bg-ink data-[state=checked]:ring-ink data-[state=indeterminate]:bg-ink data-[state=indeterminate]:ring-ink', className)}
      {...props}
    >
      <Cb.Indicator className="text-sun">{checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</Cb.Indicator>
    </Cb.Root>
  )
}
