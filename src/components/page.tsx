import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageIntro({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[34px] font-light leading-[1.05] tracking-[-0.03em] sm:text-[44px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="animate-fade" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-11 w-72" />
      <Skeleton className="mb-8 h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[28px]" />
        ))}
      </div>
      <Skeleton className="mt-4 h-80 rounded-[28px]" />
    </div>
  )
}
