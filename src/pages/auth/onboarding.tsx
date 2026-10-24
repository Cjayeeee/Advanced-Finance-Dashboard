import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Database, Rocket, Sparkles, UserRound } from 'lucide-react'
import { useApp } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput } from '@/components/ui/input'
import { Logo } from '@/components/logo'
import type { Currency, WorkspaceType } from '@/data/types'
import { CURRENCIES, parseMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const STEPS = ['Workspace', 'Type', 'Currency', 'Balance'] as const

export function OnboardingPage() {
  const { user, state, createWorkspace } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const adding = params.get('new') === '1'
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user ? `${user.name.split(' ')[0]}'s workspace` : '')
  const [type, setType] = useState<WorkspaceType>('freelancer')
  const [currency, setCurrency] = useState<Currency>('INR')
  const [balance, setBalance] = useState('')
  const [accountName, setAccountName] = useState('Main bank account')
  const [target, setTarget] = useState('')
  const [touched, setTouched] = useState(false)

  if (state && state.workspaces.length > 0 && !adding) return <Navigate to="/" replace />

  const nameError = name.trim().length < 2 ? 'Give your workspace a name' : name.length > 50 ? 'Keep it under 50 characters' : undefined
  const balanceMinor = balance.trim() === '' ? 0 : parseMoney(balance)
  const balanceError = balanceMinor === null ? 'Use numbers only, with up to 2 decimals' : undefined
  const targetMinor = target.trim() === '' ? 0 : parseMoney(target)
  const targetError = targetMinor === null || (targetMinor ?? 0) < 0 ? 'Enter a positive amount' : undefined
  const canNext = step === 0 ? !nameError : step === 3 ? !balanceError && !targetError && accountName.trim().length > 0 : true

  const finish = (withSample: boolean) => {
    createWorkspace({ name: name.trim(), type, currency, openingBalance: balanceMinor ?? 0, accountName: accountName.trim(), revenueTarget: targetMinor ?? 0, withSample })
    toast.success(withSample ? 'Sample workspace ready' : 'Workspace created', { description: withSample ? 'Explore freely. You can clear the sample data from Settings anytime.' : 'Add your first transaction to get started.' })
    navigate('/')
  }

  const next = () => {
    setTouched(true)
    if (!canNext) return
    setTouched(false)
    setStep((s) => s + 1)
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        {adding && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft /> Back to dashboard
            </Link>
          </Button>
        )}
      </div>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-10">
        <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
              <span className={cn('h-1.5 rounded-full transition-all duration-500', i < step ? 'bg-ink' : i === step ? 'bg-sun' : 'hatch bg-ink/[0.04]')} />
              <span className={cn('text-[11.5px]', i === step ? 'font-medium text-ink' : 'text-subtle')}>{s}</span>
            </li>
          ))}
        </ol>

        <form
          key={step}
          className="tile p-6 animate-rise sm:p-8"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (step < 3) next()
            else {
              setTouched(true)
              if (canNext) finish(false)
            }
          }}
        >
          {step === 0 && (
            <>
              <h1 className="font-display text-[30px] font-light tracking-tight">Name your workspace</h1>
              <p className="mt-1.5 text-[14px] text-muted">A workspace keeps one business's money separate. You can create more later.</p>
              <Field label="Workspace name" htmlFor="ws-name" error={touched ? nameError : undefined} className="mt-6">
                <Input id="ws-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={(touched && !!nameError) || undefined} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-[30px] font-light tracking-tight">What kind of work do you do?</h1>
              <p className="mt-1.5 text-[14px] text-muted">This tunes your dashboard, terminology and insights.</p>
              <div role="radiogroup" aria-label="Workspace type" className="mt-6 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { v: 'freelancer', icon: UserRound, title: 'Freelancer', body: 'Client income, invoices, project revenue and revenue targets.' },
                    { v: 'startup', icon: Rocket, title: 'Startup', body: 'Revenue, operating costs, monthly burn and cash runway.' },
                  ] as const
                ).map((o) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={type === o.v}
                    key={o.v}
                    onClick={() => setType(o.v)}
                    className={cn('relative flex flex-col items-start gap-3 rounded-[22px] p-5 text-left ring-1 transition-all duration-200', type === o.v ? 'bg-ink text-white ring-ink' : 'bg-white/70 ring-line hover:bg-white')}
                  >
                    <span className={cn('grid size-10 place-items-center rounded-full', type === o.v ? 'bg-sun text-ink' : 'bg-ink/[0.06]')}>
                      <o.icon className="size-5" />
                    </span>
                    <span className="font-display text-[19px]">{o.title}</span>
                    <span className={cn('text-[13px] leading-relaxed', type === o.v ? 'text-white/65' : 'text-muted')}>{o.body}</span>
                    {type === o.v && <Check className="absolute right-4 top-4 size-4 text-sun" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-[30px] font-light tracking-tight">Choose your currency</h1>
              <p className="mt-1.5 text-[14px] text-muted">All amounts in this workspace use one currency. Monetra doesn't convert between currencies.</p>
              <div role="radiogroup" aria-label="Currency" className="mt-6 grid grid-cols-2 gap-3">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={currency === c}
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={cn('flex items-center gap-3 rounded-[20px] p-4 text-left ring-1 transition', currency === c ? 'bg-ink text-white ring-ink' : 'bg-white/70 ring-line hover:bg-white')}
                  >
                    <span className={cn('figure grid size-11 place-items-center rounded-full text-[22px]', currency === c ? 'bg-sun text-ink' : 'bg-ink/[0.05]')}>{CURRENCIES[c].symbol}</span>
                    <span>
                      <span className="block text-[14px] font-medium">{c}</span>
                      <span className={cn('block text-[12px]', currency === c ? 'text-white/60' : 'text-muted')}>{CURRENCIES[c].name}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="font-display text-[30px] font-light tracking-tight">Starting balance</h1>
              <p className="mt-1.5 text-[14px] text-muted">How much is in your main business account today? You can add more accounts later.</p>
              <div className="mt-6 flex flex-col gap-4">
                <Field label="Account name" htmlFor="acc-name" error={touched && !accountName.trim() ? 'Name the account' : undefined}>
                  <Input id="acc-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </Field>
                <Field label="Current balance" htmlFor="balance" error={touched ? balanceError : undefined} hint="Leave empty to start at zero.">
                  <MoneyInput id="balance" symbol={CURRENCIES[currency].symbol} large placeholder="0" value={balance} onChange={(e) => setBalance(e.target.value)} aria-invalid={(touched && !!balanceError) || undefined} />
                </Field>
                {type === 'freelancer' && (
                  <Field label="Monthly revenue target" htmlFor="target" optional error={touched ? targetError : undefined} hint="Used for progress insights on your dashboard.">
                    <MoneyInput id="target" symbol={CURRENCIES[currency].symbol} placeholder="e.g. 200000" value={target} onChange={(e) => setTarget(e.target.value)} />
                  </Field>
                )}
              </div>
            </>
          )}

          <div className="mt-8 flex items-center justify-between gap-2">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft /> Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg">
              {step < 3 ? (
                <>
                  Continue <ArrowRight />
                </>
              ) : (
                'Create workspace'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-col items-center gap-3 rounded-[22px] p-5 text-center ring-1 ring-dashed ring-line-strong sm:flex-row sm:text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sun-soft">
            <Database className="size-4" />
          </span>
          <p className="flex-1 text-[13px] text-muted">
            <span className="font-medium text-ink">Just exploring?</span> Start with 14 months of realistic {type} sample data. You can clear it from Settings at any time.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => (name.trim().length >= 2 ? finish(true) : (setStep(0), setTouched(true)))}>
            <Sparkles /> Use sample data
          </Button>
        </div>
      </main>
    </div>
  )
}
