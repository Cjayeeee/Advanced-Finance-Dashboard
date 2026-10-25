import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useApp } from '@/store/app-store'

const SHORTCUTS = [
  ['N', 'Add a transaction'],
  ['Ctrl/⌘ K', 'Search everything'],
  ['?', 'Open this help'],
  ['Esc', 'Close dialogs'],
]

const DEFINITIONS: [string, string][] = [
  ['Income / Revenue', 'Sum of income transactions in the period, minus refunds you returned to clients. Invoices count only when a payment is recorded.'],
  ['Expenses', 'Sum of expense transactions in the period, minus vendor refunds.'],
  ['Net profit', 'Income − expenses on a simple cash basis. This is not accrual accounting and not a tax computation.'],
  ['Available balance', "Opening balances of your active accounts plus every recorded inflow and outflow up to today. Transfers between your own accounts don't change the total."],
  ['Outstanding receivables', 'Unpaid amounts on issued invoices (drafts and voided invoices excluded).'],
  ['Budget utilisation', 'Expenses in the budget category during its period ÷ budget limit.'],
  ['Burn & runway', 'Net burn is the average of (cash out − cash in) over your last 3 or 6 complete months. Runway is available balance ÷ net burn. It is an estimate and needs at least 2 months of history.'],
  ['Projections', 'Anything marked “estimate”, or drawn with hatched stripes, is a forecast based on recent averages, not a recorded fact.'],
]

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { cloud } = useApp()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Help & support" description="How Monetra calculates your numbers, plus a few shortcuts.">
        <h3 className="eyebrow mb-2 mt-1">Keyboard shortcuts</h3>
        <ul className="mb-6 grid gap-1.5 sm:grid-cols-2">
          {SHORTCUTS.map(([k, d]) => (
            <li key={k} className="flex items-center gap-3 rounded-xl bg-ink/[0.035] px-3 py-2 text-[13px]">
              <kbd className="min-w-14 rounded-md bg-white px-1.5 py-0.5 text-center text-[11.5px] font-medium ring-1 ring-line">{k}</kbd>
              {d}
            </li>
          ))}
        </ul>
        <h3 className="eyebrow mb-2">How numbers are calculated</h3>
        <dl className="flex flex-col divide-y divide-line">
          {DEFINITIONS.map(([t, d]) => (
            <div key={t} className="py-3">
              <dt className="text-[13.5px] font-medium">{t}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 rounded-2xl bg-sun-wash p-4 text-[13px] leading-relaxed text-ink-3 ring-1 ring-sun/30">
          <strong className="font-medium text-ink">Where your data lives.</strong>{' '}
          {cloud
            ? 'Your records are synced to your account in the cloud, with a copy kept on this device for speed. Only you can access them.'
            : 'Your data is saved in this browser (localStorage), separately for each account and workspace.'}{' '}
          There are no bank connections, payment processing or invoice emailing. Export a CSV or a backup from Settings → Data at any time.
        </div>
      </DialogContent>
    </Dialog>
  )
}
