import {
  AppWindow,
  Briefcase,
  Building2,
  CircleEllipsis,
  Cloud,
  Coffee,
  GraduationCap,
  HeartPulse,
  Landmark,
  Laptop,
  Megaphone,
  Package,
  Plane,
  Receipt,
  Repeat,
  Sparkles,
  Users,
  Wallet,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const ICONS: Record<string, LucideIcon> = {
  'app-window': AppWindow,
  megaphone: Megaphone,
  users: Users,
  laptop: Laptop,
  building: Building2,
  plane: Plane,
  briefcase: Briefcase,
  'circle-ellipsis': CircleEllipsis,
  wallet: Wallet,
  repeat: Repeat,
  package: Package,
  landmark: Landmark,
  sparkles: Sparkles,
  'graduation-cap': GraduationCap,
  coffee: Coffee,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  cloud: Cloud,
  transfer: ArrowLeftRight,
}

/** Is the colour light enough to need dark foreground? */
export function isLight(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}

export function CategoryIcon({ icon, color, size = 'md', className }: { icon?: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = ICONS[icon ?? ''] ?? CircleEllipsis
  const c = color ?? '#d8d2c4'
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full', size === 'sm' ? 'size-7' : size === 'lg' ? 'size-11' : 'size-9', className)}
      style={{ backgroundColor: c, color: isLight(c) ? '#161615' : '#fff' }}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={1.8} />
    </span>
  )
}
