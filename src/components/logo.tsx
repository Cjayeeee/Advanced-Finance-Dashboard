import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('size-9', className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#161615" />
      <circle cx="16" cy="20" r="7" fill="none" stroke="#f5cb3c" strokeWidth="3.2" />
      <circle cx="24.5" cy="20" r="7" fill="none" stroke="#fff" strokeWidth="3.2" />
    </svg>
  )
}

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!collapsed && <span className="font-display text-[21px] font-normal tracking-[-0.02em]">Monetra</span>}
    </span>
  )
}
