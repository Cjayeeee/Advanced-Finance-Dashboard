import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 h-6 text-[11.5px] font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-ink/[0.06] text-ink-3',
      ink: 'bg-ink text-white',
      sun: 'bg-sun text-ink',
      sunSoft: 'bg-sun-soft text-ink',
      gain: 'bg-gain-soft text-gain',
      loss: 'bg-loss-soft text-loss',
      outline: 'ring-1 ring-line-strong text-ink-3',
      hatch: 'hatch ring-1 ring-line-strong text-ink-3',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
