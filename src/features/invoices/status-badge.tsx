import type { InvoiceStatus } from '@/data/types'
import { Badge } from '@/components/ui/badge'
import { STATUS_META } from './utils'

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const m = STATUS_META[status]
  return (
    <Badge tone={m.tone} className={className}>
      <span className={status === 'overdue' ? 'size-1.5 rounded-full bg-loss' : status === 'paid' ? 'size-1.5 rounded-full bg-gain' : status === 'partial' ? 'size-1.5 rounded-full bg-sun-deep' : 'size-1.5 rounded-full bg-current opacity-40'} />
      {m.label}
    </Badge>
  )
}
