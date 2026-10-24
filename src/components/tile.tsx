import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Tile({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  return (
    <As className={cn('tile p-5 sm:p-6', className)} {...rest}>
      {children}
    </As>
  )
}

export function TileHeader({ title, id, action, to, subtitle, className, inverse }: { title: ReactNode; id?: string; action?: ReactNode; to?: string; subtitle?: ReactNode; className?: string; inverse?: boolean }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[19px] font-normal tracking-tight">
          {title}
        </h2>
        {subtitle && <p className={cn('mt-0.5 text-[12.5px]', inverse ? 'text-white/55' : 'text-muted')}>{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {to && (
          <Link
            to={to}
            aria-label={`Open ${typeof title === 'string' ? title : 'details'}`}
            className={cn('grid size-9 place-items-center rounded-full transition-all duration-200 hover:rotate-45', inverse ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-ink shadow-[0_1px_2px_rgb(22_22_21/0.08)] hover:bg-sun')}
          >
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
