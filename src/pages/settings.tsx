import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, Banknote, Building2, Database, Download, FolderKanban, Landmark, Lock, Mail, MoreHorizontal, Pencil, Plus, RotateCcw, Tags, Trash2, UserRound, Users } from 'lucide-react'
import { useActiveWorkspace, useApp } from '@/store/app-store'
import { useFormat } from '@/hooks/use-format'
import { useTerms } from '@/hooks/use-terms'
import { PageIntro } from '@/components/page'
import { CategoryIcon } from '@/components/category-icon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown'
import { CategoryDialog } from '@/features/categories/category-dialog'
import { ClientDialog } from '@/features/clients/client-dialog'
import { exportTransactionsCSV } from '@/features/transactions/export'
import type { Account, AccountKind, Category, Client, Currency, NumberLocale, Project } from '@/data/types'
import { accountBalances } from '@/lib/finance'
import { CURRENCIES, LOCALES, formatMoney, parseMoney, toInputString } from '@/lib/money'
import { downloadFile } from '@/lib/csv'
import { uid } from '@/lib/id'
import { todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'workspace', label: 'Workspace', icon: Building2 },
  { id: 'reporting', label: 'Currency & reporting', icon: Banknote },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'clients', label: 'Clients & projects', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Mail },
  { id: 'data', label: 'Data', icon: Database },
] as const

export default function SettingsPage() {
  const { tab = 'profile' } = useParams()
  const terms = useTerms()
  return (
    <>
      <PageIntro title="Settings" description="Your profile, this workspace, and how numbers are shown." />
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 no-scrollbar lg:sticky lg:top-24 lg:flex-col lg:self-start">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              to={`/settings/${t.id}`}
              className={({ isActive }) => cn('flex h-10 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-[13.5px] transition', isActive || (tab === t.id && t.id === 'profile') ? 'bg-ink text-white' : 'text-ink-3 hover:bg-white/70')}
            >
              <t.icon className="size-4" />
              {t.id === 'clients' ? `${terms.clients} & projects` : t.label}
            </NavLink>
          ))}
        </nav>
        <div key={tab} className="flex min-w-0 flex-col gap-4 animate-rise">
          {tab === 'profile' && <ProfileSection />}
          {tab === 'workspace' && <WorkspaceSection />}
          {tab === 'reporting' && <ReportingSection />}
          {tab === 'categories' && <CategoriesSection />}
          {tab === 'accounts' && <AccountsSection />}
          {tab === 'clients' && <ClientsSection />}
          {tab === 'notifications' && <NotificationsSection />}
          {tab === 'data' && <DataSection />}
        </div>
      </div>
    </>
  )
}

function Section({ title, description, children, action }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="tile p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px]">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-[13px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl p-4 ring-1 ring-dashed ring-line-strong hatch">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted" />
      <div>
        <p className="flex items-center gap-2 text-[13.5px] font-medium">
          {title} <Badge tone="outline">Unavailable</Badge>
        </p>
        <p className="mt-0.5 text-[12.5px] text-muted">{body}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────── Profile ─────────────────────────── */

function ProfileSection() {
  const { user, updateProfile, cloud } = useApp()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const emailBad = !/^\S+@\S+\.\S+$/.test(email)
  return (
    <>
      <Section title="Profile" description="Shown on invoices as the sender when no business name is set.">
        <form
          className="grid max-w-xl gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (name.trim().length < 2 || emailBad) return toast.error('Check your name and email')
            setBusy(true)
            try {
              const r = await updateProfile({ name: name.trim(), email: email.trim() })
              if (r.emailPending) toast.success('Check your inbox', { description: `Confirm the change using the link sent to ${email.trim()}.` })
              else toast.success('Profile updated')
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't update your profile")
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="Full name" htmlFor="p-name" error={name.trim().length < 2 ? 'Enter your name' : undefined}>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="p-email" error={emailBad ? 'Enter a valid email' : undefined}>
            <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Section>
      <Section title="Security">
        <div className="flex flex-col gap-3">
          {cloud ? (
            <p className="text-[13px] text-muted">Your account is managed by secure cloud sign-in, and your data is synced to your account. Each user can only ever access their own records. To change your password, sign out and use “Forgot password”, and we'll email you a reset link.</p>
          ) : (
            <p className="text-[13px] text-muted">Passwords are salted and hashed (PBKDF2) before storage in this browser. To change yours, sign out and use “Forgot password”.</p>
          )}
          <Unavailable title="Two-factor authentication" body="Not available yet." />
        </div>
      </Section>
    </>
  )
}

/* ─────────────────────────── Workspace ─────────────────────────── */

function WorkspaceSection() {
  const { ws } = useActiveWorkspace()
  const { updateWorkspace } = useApp()
  const { symbol } = useFormat()
  const [f, setF] = useState({
    name: ws.name,
    businessEmail: ws.businessEmail ?? '',
    businessAddress: ws.businessAddress ?? '',
    businessTaxId: ws.businessTaxId ?? '',
    invoicePrefix: ws.invoicePrefix,
    defaultTaxRate: String(ws.defaultTaxRate),
    defaultTaxLabel: ws.defaultTaxLabel,
    defaultTerms: ws.defaultTerms,
    revenueTarget: ws.revenueTarget ? toInputString(ws.revenueTarget) : '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const target = f.revenueTarget.trim() === '' ? 0 : parseMoney(f.revenueTarget)
  const tax = Number(f.defaultTaxRate)
  const errs = {
    name: f.name.trim().length < 2 ? 'Name is required' : undefined,
    target: target === null || target < 0 ? 'Enter a valid amount' : undefined,
    tax: !/^\d+(\.\d{1,2})?$/.test(f.defaultTaxRate) || tax > 100 ? 'Use 0–100' : undefined,
    prefix: f.invoicePrefix.length > 10 ? 'Max 10 characters' : undefined,
  }
  const save = () => {
    if (Object.values(errs).some(Boolean)) return toast.error('Fix the highlighted fields')
    updateWorkspace({ name: f.name.trim(), businessEmail: f.businessEmail.trim() || undefined, businessAddress: f.businessAddress.trim() || undefined, businessTaxId: f.businessTaxId.trim() || undefined, invoicePrefix: f.invoicePrefix, defaultTaxRate: tax, defaultTaxLabel: f.defaultTaxLabel.trim(), defaultTerms: f.defaultTerms, revenueTarget: target ?? 0 })
    toast.success('Workspace saved')
  }
  return (
    <>
      <Section title="Workspace details" description="Business details appear on your invoices.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Workspace / business name" htmlFor="w-name" error={errs.name}>
            <Input id="w-name" value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Business email" htmlFor="w-email" optional>
            <Input id="w-email" type="email" value={f.businessEmail} onChange={set('businessEmail')} />
          </Field>
          <Field label="Business address" htmlFor="w-addr" optional>
            <Textarea id="w-addr" rows={2} value={f.businessAddress} onChange={set('businessAddress')} />
          </Field>
          <Field label="Tax ID (GSTIN / VAT)" htmlFor="w-tax" optional>
            <Input id="w-tax" value={f.businessTaxId} onChange={set('businessTaxId')} />
          </Field>
          <Field label="Workspace type" htmlFor="w-type" hint="Set when the workspace was created. Create a new workspace to switch types.">
            <Input id="w-type" value={ws.type === 'startup' ? 'Startup' : 'Freelancer'} disabled />
          </Field>
          <Field label="Monthly revenue target" htmlFor="w-target" optional error={errs.target} hint="Used for dashboard progress insights.">
            <MoneyInput id="w-target" symbol={symbol} value={f.revenueTarget} onChange={set('revenueTarget')} />
          </Field>
        </div>
      </Section>
      <Section title="Invoice defaults">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Number prefix" htmlFor="w-prefix" error={errs.prefix} hint={`Next: ${f.invoicePrefix}${new Date().getFullYear()}-###`}>
            <Input id="w-prefix" value={f.invoicePrefix} onChange={set('invoicePrefix')} />
          </Field>
          <Field label="Default tax label" htmlFor="w-taxl">
            <Input id="w-taxl" value={f.defaultTaxLabel} onChange={set('defaultTaxLabel')} />
          </Field>
          <Field label="Default tax rate %" htmlFor="w-taxr" error={errs.tax}>
            <Input id="w-taxr" inputMode="decimal" value={f.defaultTaxRate} onChange={set('defaultTaxRate')} />
          </Field>
          <Field label="Default payment terms" htmlFor="w-terms" className="sm:col-span-3">
            <Textarea id="w-terms" rows={2} value={f.defaultTerms} onChange={set('defaultTerms')} />
          </Field>
        </div>
        <div className="mt-5">
          <Button onClick={save}>Save workspace</Button>
        </div>
      </Section>
    </>
  )
}

/* ─────────────────────────── Reporting ─────────────────────────── */

function ReportingSection() {
  const { ws, data } = useActiveWorkspace()
  const { updateWorkspace } = useApp()
  const [pendingCurrency, setPendingCurrency] = useState<Currency | null>(null)
  const hasData = data.transactions.length > 0 || data.invoices.length > 0
  const sample = formatMoney(123456789, ws.currency, ws.locale, { decimals: true })
  return (
    <>
      <Section title="Currency & number format" description="Each workspace uses a single currency. Changing it relabels amounts. It does not convert them.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="r-cur">
            <Select id="r-cur" value={ws.currency} onValueChange={(v) => (hasData ? setPendingCurrency(v as Currency) : updateWorkspace({ currency: v as Currency }))} options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: `${CURRENCIES[c].symbol}  ${c} · ${CURRENCIES[c].name}` }))} />
          </Field>
          <Field label="Number format" htmlFor="r-loc" hint={`Preview: ${sample}`}>
            <Select id="r-loc" value={ws.locale} onValueChange={(v) => (updateWorkspace({ locale: v as NumberLocale }), toast.success('Number format updated'))} options={LOCALES.map((l) => ({ value: l.value, label: l.label, hint: l.sample }))} />
          </Field>
        </div>
        <div className="mt-4">
          <Unavailable title="Multi-currency & exchange rates" body="Converting between currencies needs live FX rates, which aren't available here. Use separate workspaces for separate currencies." />
        </div>
      </Section>
      <Section title="Reporting preferences">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium">Burn-rate window</p>
              <p className="text-[12.5px] text-muted">Complete months averaged for burn and runway estimates.</p>
            </div>
            <Segmented label="Burn window" value={String(ws.burnWindow) as '3' | '6'} onChange={(v) => (updateWorkspace({ burnWindow: Number(v) as 3 | 6 }), toast.success('Burn window updated'))} options={[{ value: '3', label: '3 months' }, { value: '6', label: '6 months' }]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium">Week starts on</p>
              <p className="text-[12.5px] text-muted">Used for weekly chart buckets.</p>
            </div>
            <Segmented label="Week start" value={String(ws.weekStartsOn) as '0' | '1'} onChange={(v) => updateWorkspace({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium">Accounting basis</p>
              <p className="text-[12.5px] text-muted">Reports use a simple cash basis: money counts when it's recorded as received or paid.</p>
            </div>
            <Badge tone="ink">Cash basis</Badge>
          </div>
          <Unavailable title="Accrual accounting & tax reports" body="Accrual reporting, GST/VAT returns and statutory statements aren't supported. Export CSVs for your accountant." />
        </div>
      </Section>
      <ConfirmDialog
        open={!!pendingCurrency}
        onOpenChange={(o) => !o && setPendingCurrency(null)}
        destructive={false}
        title={`Switch to ${pendingCurrency}?`}
        description={`Existing amounts will be shown in ${pendingCurrency} without conversion. For example, 1,000 ${ws.currency} becomes 1,000 ${pendingCurrency}. Only do this if you entered amounts in the wrong currency.`}
        confirmLabel="Switch currency"
        onConfirm={() => {
          if (pendingCurrency) updateWorkspace({ currency: pendingCurrency, locale: CURRENCIES[pendingCurrency].defaultLocale })
          toast.success('Currency changed')
          setPendingCurrency(null)
        }}
      />
    </>
  )
}

/* ─────────────────────────── Categories ─────────────────────────── */

function CategoriesSection() {
  const { data, actions } = useActiveWorkspace()
  const [dialog, setDialog] = useState<{ open: boolean; editing?: Category | null; kind?: 'income' | 'expense' }>({ open: false })
  const [del, setDel] = useState<Category | null>(null)
  const [reassign, setReassign] = useState('')
  const usage = (id: string) => data.transactions.filter((t) => t.categoryId === id).length
  const list = (kind: 'income' | 'expense') => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {data.categories
        .filter((c) => c.kind === kind)
        .map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/55 p-3 ring-1 ring-line">
            <CategoryIcon icon={c.icon} color={c.color} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
              <span className="text-[12px] text-muted">{usage(c.id)} transactions</span>
            </span>
            <Dropdown>
              <DropdownTrigger asChild>
                <button className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label={`Actions for ${c.name}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownItem onSelect={() => setDialog({ open: true, editing: c })}>
                  <Pencil /> Edit
                </DropdownItem>
                <DropdownItem destructive onSelect={() => (setDel(c), setReassign(''))}>
                  <Trash2 /> Delete
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          </li>
        ))}
    </ul>
  )
  const delCount = del ? usage(del.id) : 0
  return (
    <>
      <Section title="Expense categories" description="Used by transactions, budgets and reports." action={<Button size="sm" onClick={() => setDialog({ open: true, kind: 'expense' })}><Plus /> Add</Button>}>
        {list('expense')}
      </Section>
      <Section title="Income categories" action={<Button size="sm" variant="secondary" onClick={() => setDialog({ open: true, kind: 'income' })}><Plus /> Add</Button>}>
        {list('income')}
      </Section>
      <CategoryDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} editing={dialog.editing} defaultKind={dialog.kind} />
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete “${del?.name}”?`}
        description={delCount ? `${delCount} transactions use this category. Choose where to move them. Any budgets for this category will be removed.` : 'No transactions use this category.'}
        onConfirm={() => {
          if (!del) return
          actions.deleteCategory(del.id, reassign || undefined)
          toast.success('Category deleted')
          setDel(null)
        }}
      >
        {delCount > 0 && del && (
          <div className="mt-4">
            <Select aria-label="Move transactions to" value={reassign || 'none'} onValueChange={(v) => setReassign(v === 'none' ? '' : v)} options={[{ value: 'none', label: 'Leave uncategorised' }, ...data.categories.filter((c) => c.kind === del.kind && c.id !== del.id).map((c) => ({ value: c.id, label: `Move to ${c.name}` }))]} />
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}

/* ─────────────────────────── Accounts ─────────────────────────── */

function AccountsSection() {
  const { data, actions } = useActiveWorkspace()
  const { money } = useFormat()
  const [editing, setEditing] = useState<Account | null | undefined>(undefined)
  const balances = accountBalances(data.accounts, data.transactions)
  return (
    <>
      <Section title="Accounts & payment methods" description="Balances are opening balance plus every recorded transaction. Archived accounts are excluded from your available balance." action={<Button size="sm" onClick={() => setEditing(null)}><Plus /> Add account</Button>}>
        <ul className="flex flex-col divide-y divide-line">
          {data.accounts.map((a) => (
            <li key={a.id} className={cn('flex flex-wrap items-center gap-3 py-3', a.archived && 'opacity-55')}>
              <span className="grid size-10 place-items-center rounded-full bg-ink text-sun">
                <Landmark className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">
                  {a.name} {a.archived && <Badge tone="outline">Archived</Badge>}
                </span>
                <span className="text-[12px] capitalize text-muted">
                  {a.kind} · opening {money(a.openingBalance)}
                </span>
              </span>
              <span className={cn('figure text-[22px]', (balances.get(a.id) ?? 0) < 0 && 'text-loss')}>{money(balances.get(a.id) ?? 0)}</span>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => (actions.saveAccount({ ...a, archived: !a.archived }), toast(a.archived ? 'Account restored' : 'Account archived'))} aria-label={a.archived ? `Restore ${a.name}` : `Archive ${a.name}`} disabled={!a.archived && data.accounts.filter((x) => !x.archived).length === 1}>
                  {a.archived ? <ArchiveRestore /> : <Archive />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Unavailable title="Bank connections & automatic imports" body="Monetra doesn't connect to banks or import statements automatically. Record transactions manually." />
        </div>
      </Section>
      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        {editing !== undefined && <AccountForm editing={editing} onDone={() => setEditing(undefined)} />}
      </Dialog>
    </>
  )
}

function AccountForm({ editing, onDone }: { editing: Account | null; onDone: () => void }) {
  const { actions, data } = useActiveWorkspace()
  const { completeStep } = useApp()
  const { symbol } = useFormat()
  const [name, setName] = useState(editing?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(editing?.kind ?? 'bank')
  const [opening, setOpening] = useState(editing ? toInputString(editing.openingBalance) : '')
  const [touched, setTouched] = useState(false)
  const minor = opening.trim() === '' ? 0 : parseMoney(opening)
  const errs = { name: !name.trim() ? 'Name the account' : data.accounts.some((a) => a.id !== editing?.id && a.name.toLowerCase() === name.trim().toLowerCase()) ? 'Name already used' : undefined, opening: minor === null ? 'Enter a valid amount (negative allowed for card debt)' : undefined }
  const save = () => {
    setTouched(true)
    if (errs.name || errs.opening) return
    actions.saveAccount({ id: editing?.id ?? uid('acc'), name: name.trim(), kind, openingBalance: minor!, archived: editing?.archived })
    if (minor) completeStep('balance')
    toast.success(editing ? 'Account updated' : 'Account added')
    onDone()
  }
  return (
    <DialogContent title={editing ? 'Edit account' : 'New account'} description="Opening balance is what the account held when you started tracking it." footer={<><Button variant="ghost" onClick={onDone}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Account name" htmlFor="a-name" error={touched ? errs.name : undefined}>
          <Input id="a-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC Current" />
        </Field>
        <Field label="Type" htmlFor="a-kind">
          <Select id="a-kind" value={kind} onValueChange={(v) => setKind(v as AccountKind)} options={[{ value: 'bank', label: 'Bank account' }, { value: 'card', label: 'Credit / debit card' }, { value: 'wallet', label: 'Wallet / UPI / payment app' }, { value: 'cash', label: 'Cash' }]} />
        </Field>
        <Field label="Opening balance" htmlFor="a-open" error={touched ? errs.opening : undefined} hint="Use a negative number for a card that started with debt.">
          <MoneyInput id="a-open" symbol={symbol} value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        </Field>
      </form>
    </DialogContent>
  )
}

/* ─────────────────────────── Clients & projects ─────────────────────────── */

function ClientsSection() {
  const { data, actions } = useActiveWorkspace()
  const terms = useTerms()
  const [clientDialog, setClientDialog] = useState<{ open: boolean; editing?: Client | null }>({ open: false })
  const [projectDialog, setProjectDialog] = useState<Project | null | undefined>(undefined)
  const [pName, setPName] = useState('')
  const [pClient, setPClient] = useState('')
  const openProject = (p: Project | null) => {
    setProjectDialog(p)
    setPName(p?.name ?? '')
    setPClient(p?.clientId ?? '')
  }
  return (
    <>
      <Section title={terms.clients} description="Used on invoices and to group income." action={<Button size="sm" onClick={() => setClientDialog({ open: true })}><Plus /> Add {terms.client.toLowerCase()}</Button>}>
        {data.clients.length === 0 ? (
          <p className="text-[13px] text-muted">No {terms.clients.toLowerCase()} yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.clients.map((c) => (
              <li key={c.id}>
                <button onClick={() => setClientDialog({ open: true, editing: c })} className="flex w-full items-center gap-3 rounded-2xl bg-white/55 p-3 text-left ring-1 ring-line transition hover:bg-white">
                  <span className="grid size-9 place-items-center rounded-full bg-sun-soft text-[13px] font-semibold">{c.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{c.name}</span>
                    <span className="block truncate text-[12px] text-muted">{c.email ?? 'No email'}</span>
                  </span>
                  <Pencil className="size-3.5 text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Projects" description="Optional. Tag income and expenses with a project to see revenue per project." action={<Button size="sm" variant="secondary" onClick={() => openProject(null)}><FolderKanban /> Add project</Button>}>
        {data.projects.length === 0 ? (
          <p className="text-[13px] text-muted">No projects yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {data.projects.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <FolderKanban className="size-4 text-muted" />
                <span className="flex-1 text-[13.5px]">{p.name}</span>
                <span className="text-[12px] text-muted">{data.clients.find((c) => c.id === p.clientId)?.name ?? '—'}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => openProject(p)} aria-label={`Edit ${p.name}`}>
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <ClientDialog open={clientDialog.open} onOpenChange={(o) => setClientDialog({ open: o })} editing={clientDialog.editing} />
      <Dialog open={projectDialog !== undefined} onOpenChange={(o) => !o && setProjectDialog(undefined)}>
        {projectDialog !== undefined && (
          <DialogContent
            title={projectDialog ? 'Edit project' : 'New project'}
            footer={
              <>
                <Button variant="ghost" onClick={() => setProjectDialog(undefined)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!pName.trim()) return toast.error('Name the project')
                    actions.saveProject({ id: projectDialog?.id ?? uid('pr'), name: pName.trim(), clientId: pClient || undefined })
                    toast.success('Project saved')
                    setProjectDialog(undefined)
                  }}
                >
                  Save
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field label="Project name" htmlFor="pr-name">
                <Input id="pr-name" autoFocus value={pName} onChange={(e) => setPName(e.target.value)} />
              </Field>
              <Field label={terms.client} htmlFor="pr-client" optional>
                <Select id="pr-client" value={pClient || 'none'} onValueChange={(v) => setPClient(v === 'none' ? '' : v)} options={[{ value: 'none', label: 'None' }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]} />
              </Field>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

/* ─────────────────────────── Notifications ─────────────────────────── */

function NotificationsSection() {
  const { state, setPrefs } = useApp()
  const p = state!.prefs
  const rows: { key: keyof typeof p; title: string; body: string; available: boolean }[] = [
    { key: 'budgetAlerts', title: 'Budget alerts', body: 'When a budget crosses its warning threshold or is exceeded.', available: true },
    { key: 'overdueInvoices', title: 'Invoice reminders', body: 'When an invoice is due within 5 days or becomes overdue.', available: true },
  ]
  return (
    <Section title="In-app notifications" description="Shown in the bell menu. Notifications are calculated from your data each time you open the app.">
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 py-3.5">
            <label htmlFor={`n-${r.key}`} className="min-w-0">
              <span className="block text-[14px] font-medium">{r.title}</span>
              <span className="block text-[12.5px] text-muted">{r.body}</span>
            </label>
            <Switch id={`n-${r.key}`} checked={p[r.key]} onCheckedChange={(v) => setPrefs({ [r.key]: v })} />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2">
        <Unavailable title="Email & push notifications" body="Delivering email or push notifications requires a server. Not available in this build." />
        <Unavailable title="Weekly email digest" body="Planned. Requires email delivery." />
      </div>
    </Section>
  )
}

/* ─────────────────────────── Data ─────────────────────────── */

function DataSection() {
  const { ws, data } = useActiveWorkspace()
  const { state, resetSampleData, clearWorkspaceData, deleteWorkspace } = useApp()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'reset' | 'clear' | 'delete' | null>(null)
  const backup = () => {
    downloadFile(`${ws.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-backup-${todayISO()}.json`, new Blob([JSON.stringify({ app: 'monetra', version: 1, exportedAt: new Date().toISOString(), workspace: ws, data }, null, 2)], { type: 'application/json' }))
    toast.success('Backup downloaded')
  }
  return (
    <>
      <Section title="Export" description="Your data is stored in this browser. Export regularly to keep a copy.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!data.transactions.length} onClick={() => (exportTransactionsCSV(data.transactions, data, ws, 'all-transactions'), toast.success(`Exported ${data.transactions.length} transactions`))}>
            <Download /> All transactions (CSV)
          </Button>
          <Button variant="secondary" onClick={backup}>
            <Download /> Full workspace backup (JSON)
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          {data.transactions.length} transactions · {data.invoices.length} invoices · {data.budgets.length} budgets · {data.clients.length} clients
        </p>
      </Section>
      <Section title="Sample data" description={ws.isSample ? 'This workspace contains generated sample data.' : 'Load realistic sample data to explore features. This replaces the data in this workspace.'}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setConfirm('reset')}>
            <RotateCcw /> {ws.isSample ? 'Reset sample data' : 'Replace with sample data'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('clear')} disabled={!data.transactions.length && !data.invoices.length}>
            <Trash2 /> Clear all records
          </Button>
        </div>
      </Section>
      <Section title="Danger zone">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-loss-soft/50 p-4">
          <div>
            <p className="text-[14px] font-medium">Delete “{ws.name}”</p>
            <p className="text-[12.5px] text-muted">Permanently removes this workspace and all its records from this browser.</p>
          </div>
          <Button variant="danger" onClick={() => setConfirm('delete')}>
            Delete workspace
          </Button>
        </div>
      </Section>
      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Replace with fresh sample data?"
        description="All transactions, invoices and budgets in this workspace will be replaced with regenerated sample data."
        confirmLabel="Reset data"
        onConfirm={() => (resetSampleData(), toast.success('Sample data restored'), setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Clear all records?"
        description="Deletes every transaction, invoice, budget, client and project in this workspace. Categories and accounts are kept, with opening balances set to zero."
        confirmLabel="Clear records"
        onConfirm={() => (clearWorkspaceData(), toast.success('Workspace cleared'), setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${ws.name}?`}
        description="This cannot be undone. Consider downloading a backup first."
        confirmLabel="Delete workspace"
        onConfirm={() => {
          const remaining = state!.workspaces.length - 1
          deleteWorkspace(ws.id)
          toast.success('Workspace deleted')
          navigate(remaining > 0 ? '/' : '/onboarding')
        }}
      />
    </>
  )
}
