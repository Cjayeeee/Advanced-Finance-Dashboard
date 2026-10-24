import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-8' : 'gap-3 py-14', className)}>
      {icon && <div className="grid size-12 place-items-center rounded-full bg-ink/[0.05] text-muted hatch [&_svg]:size-5">{icon}</div>}
      <div>
        <p className="font-display text-[17px] tracking-tight">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
