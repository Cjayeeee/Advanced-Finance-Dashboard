import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowRight, Eye, EyeOff, MailCheck, Rocket, Sparkles, UserRound } from 'lucide-react'
import { useApp } from '@/store/app-store'
import { AuthError, listUsers, resetPassword } from '@/store/auth'
import { NeedsConfirmation, cloudSendReset, cloudUpdatePassword } from '@/store/cloud'
import { cloudEnabled } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'

/* ─────────────────────────── layout ─────────────────────────── */

function Showcase() {
  const bars = [38, 62, 48, 80, 56, 92, 70]
  return (
    <div className="tile-ink relative hidden overflow-hidden p-10 lg:flex lg:flex-col">
      <div className="absolute -right-24 -bottom-24 size-[420px] rounded-full bg-sun/25 blur-3xl" aria-hidden />
      <p className="eyebrow !text-white/50">For freelancers & early-stage teams</p>
      <h2 className="mt-4 max-w-md font-display text-[44px] font-light leading-[1.05] tracking-[-0.03em]">
        Know what you earn, where it goes, and <span className="text-sun">how long it lasts.</span>
      </h2>
      <div className="relative mt-auto grid grid-cols-2 gap-3" aria-hidden>
        <div className="rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10">
          <p className="text-[12px] text-white/50">Net profit · Oct</p>
          <p className="figure mt-3 text-[46px]">₹1.42L</p>
          <p className="mt-2 inline-flex rounded-full bg-sun px-2 py-0.5 text-[11px] font-medium text-ink">+18.4%</p>
        </div>
        <div className="rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10">
          <p className="text-[12px] text-white/50">Cash flow</p>
          <div className="mt-4 flex h-[86px] items-end justify-between gap-1.5">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                <span className={i === 5 ? 'w-1.5 rounded-full bg-sun' : 'w-1.5 rounded-full bg-white/70'} style={{ height: `${h}%` }} />
                <span className={i === 5 ? 'size-1.5 rounded-full bg-sun' : 'size-1.5 rounded-full bg-white/70'} />
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-4 rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10">
          <div className="flex h-9 flex-1 overflow-hidden rounded-full">
            <span className="w-[42%] bg-sun" />
            <span className="w-[26%] bg-white" />
            <span className="w-[14%] bg-white/40" />
            <span className="hatch-light flex-1 bg-white/5" />
          </div>
          <span className="text-[12px] text-white/60">Budget · 68% used</span>
        </div>
      </div>
    </div>
  )
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-3 py-4 sm:px-8 lg:px-14">
        <Link to="/" aria-label="Monetra home" className="self-start rounded-xl">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 animate-rise">
          <h1 className="font-display text-[38px] font-light leading-tight tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-[14px] text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-[13.5px] text-muted">{footer}</div>}
        </main>
        <p className="text-[11.5px] leading-relaxed text-subtle">
          {cloudEnabled
            ? 'Your account and financial data are stored securely in the cloud and synced across your devices. The demo workspace stays in this browser.'
            : 'Local build. Accounts and financial data are stored only in this browser, with passwords salted and hashed.'}
        </p>
      </div>
      <Showcase />
    </div>
  )
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-11" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function DemoButtons() {
  const { loginDemo } = useApp()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const go = async (type: 'freelancer' | 'startup') => {
    setBusy(type)
    try {
      await loginDemo(type)
      navigate('/')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-[12px] text-subtle">
        <span className="h-px flex-1 bg-line-strong" /> or explore a sample workspace <span className="h-px flex-1 bg-line-strong" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => go('freelancer')} disabled={!!busy}>
          <UserRound /> {busy === 'freelancer' ? 'Loading…' : 'Freelancer'}
        </Button>
        <Button variant="sun" onClick={() => go('startup')} disabled={!!busy}>
          <Rocket /> {busy === 'startup' ? 'Loading…' : 'Startup'}
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────── login ─────────────────────────── */

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) })
  const hasUsers = listUsers().length > 0

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your workspace."
      footer={
        <>
          New to Monetra?{' '}
          <Link to="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null)
          try {
            await login(v.email, v.password)
            navigate(loc.state?.from ?? '/')
          } catch (e) {
            setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
          }
        })}
      >
        {error && (
          <p role="alert" className="rounded-2xl bg-loss-soft px-4 py-3 text-[13px] text-loss animate-fade">
            {error}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@studio.com" {...register('email')} aria-invalid={!!formState.errors.email || undefined} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link to="/forgot" className="text-[12.5px] font-normal text-muted hover:text-ink">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
          error={formState.errors.password?.message}
        >
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} aria-invalid={!!formState.errors.password || undefined} />
        </Field>
        <Button type="submit" size="lg" className="mt-2" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Signing in…' : 'Sign in'} <ArrowRight />
        </Button>
        {!hasUsers && !cloudEnabled && <p className="text-center text-[12.5px] text-subtle">No accounts on this device yet. Create one or try a sample workspace.</p>}
      </form>
      <DemoButtons />
    </AuthLayout>
  )
}

/* ─────────────────────────── signup ─────────────────────────── */

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(60),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
})

export function SignupPage() {
  const { signup } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema), mode: 'onTouched' })

  if (confirmEmail)
    return (
      <AuthLayout title="Check your email" subtitle="One more step to finish creating your account.">
        <div className="flex gap-3 rounded-2xl bg-sun-wash p-5 text-[14px] leading-relaxed text-ink-3 ring-1 ring-sun/30">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>
            We sent a confirmation link to <strong className="font-medium text-ink">{confirmEmail}</strong>. Open it on this device to activate your account. You'll be signed in automatically.
          </p>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Didn't get it? Check your spam folder, or{' '}
          <button className="font-medium text-ink underline-offset-4 hover:underline" onClick={() => setConfirmEmail(null)}>
            try a different email
          </button>
          .
        </p>
      </AuthLayout>
    )

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up a workspace in under a minute. Free to explore."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null)
          try {
            await signup(v.name, v.email, v.password)
            navigate('/onboarding')
          } catch (e) {
            if (e instanceof NeedsConfirmation) return setConfirmEmail(e.message)
            setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
          }
        })}
      >
        {error && (
          <p role="alert" className="rounded-2xl bg-loss-soft px-4 py-3 text-[13px] text-loss">
            {error}
          </p>
        )}
        <Field label="Full name" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" autoComplete="name" placeholder="Aarav Mehta" {...register('name')} aria-invalid={!!formState.errors.name || undefined} />
        </Field>
        <Field label="Work email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@studio.com" {...register('email')} aria-invalid={!!formState.errors.email || undefined} />
        </Field>
        <Field label="Password" htmlFor="password" error={formState.errors.password?.message} hint="At least 8 characters, with a letter and a number.">
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} aria-invalid={!!formState.errors.password || undefined} />
        </Field>
        <Button type="submit" size="lg" className="mt-2" disabled={formState.isSubmitting}>
          Create account <ArrowRight />
        </Button>
      </form>
      <DemoButtons />
    </AuthLayout>
  )
}

/* ─────────────────────────── forgot ─────────────────────────── */

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: signupSchema.shape.password,
})

export function ForgotPage() {
  if (cloudEnabled) return <CloudForgot />
  return <LocalForgot />
}

function LocalForgot() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), mode: 'onTouched' })
  return (
    <AuthLayout
      title="Reset password"
      subtitle="Set a new password for an account on this device."
      footer={
        <Link to="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <div className="mb-5 flex gap-3 rounded-2xl bg-sun-wash p-4 text-[13px] leading-relaxed text-ink-3 ring-1 ring-sun/30">
        <Sparkles className="mt-0.5 size-4 shrink-0" />
        <p>
          This local build can't send reset emails. Accounts live only in this browser, so you can set a new password directly here. A hosted version would email you a secure reset link instead.
        </p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null)
          try {
            await resetPassword(v.email, v.password)
            toast.success('Password updated', { description: 'Sign in with your new password.' })
            navigate('/login')
          } catch (e) {
            setError(e instanceof AuthError ? e.message : 'Something went wrong.')
          }
        })}
      >
        {error && (
          <p role="alert" className="rounded-2xl bg-loss-soft px-4 py-3 text-[13px] text-loss">
            {error}
          </p>
        )}
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!formState.errors.email || undefined} />
        </Field>
        <Field label="New password" htmlFor="password" error={formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} aria-invalid={!!formState.errors.password || undefined} />
        </Field>
        <Button type="submit" size="lg" className="mt-2">
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}

/* Cloud mode: email a secure reset link, then set the new password on /reset-password. */

const emailOnly = z.object({ email: z.string().trim().email('Enter a valid email address') })

function CloudForgot() {
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof emailOnly>>({ resolver: zodResolver(emailOnly), mode: 'onTouched' })
  return (
    <AuthLayout
      title="Reset password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <Link to="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="flex gap-3 rounded-2xl bg-sun-wash p-5 text-[14px] leading-relaxed text-ink-3 ring-1 ring-sun/30">
          <MailCheck className="mt-0.5 size-5 shrink-0" />
          <p>
            If an account exists for <strong className="font-medium text-ink">{sent}</strong>, a reset link is on its way. The link expires after an hour.
          </p>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (v) => {
            setError(null)
            try {
              await cloudSendReset(v.email)
              setSent(v.email.trim().toLowerCase())
            } catch (e) {
              setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
            }
          })}
        >
          {error && (
            <p role="alert" className="rounded-2xl bg-loss-soft px-4 py-3 text-[13px] text-loss">
              {error}
            </p>
          )}
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!formState.errors.email || undefined} />
          </Field>
          <Button type="submit" size="lg" className="mt-2" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

const newPassword = z
  .object({ password: signupSchema.shape.password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "Passwords don't match" })

export function ResetPasswordPage() {
  const { user, ready, passwordRecovery, clearPasswordRecovery } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof newPassword>>({ resolver: zodResolver(newPassword), mode: 'onTouched' })
  const canReset = cloudEnabled && (passwordRecovery || user?.provider === 'cloud')

  if (!cloudEnabled) return <LocalForgot />
  if (!ready)
    return (
      <AuthLayout title="Choose a new password" subtitle="Checking your reset link…">
        <span />
      </AuthLayout>
    )
  if (!canReset)
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is invalid or has already been used.">
        <Button asChild size="lg">
          <Link to="/forgot">Send a new link</Link>
        </Button>
      </AuthLayout>
    )
  return (
    <AuthLayout title="Choose a new password" subtitle={user ? `For ${user.email}` : 'Set the password you\'ll use to sign in.'}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit(async (v) => {
          setError(null)
          try {
            await cloudUpdatePassword(v.password)
            clearPasswordRecovery()
            toast.success('Password updated')
            navigate('/')
          } catch (e) {
            setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.')
          }
        })}
      >
        {error && (
          <p role="alert" className="rounded-2xl bg-loss-soft px-4 py-3 text-[13px] text-loss">
            {error}
          </p>
        )}
        <Field label="New password" htmlFor="password" error={formState.errors.password?.message} hint="At least 8 characters, with a letter and a number.">
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} aria-invalid={!!formState.errors.password || undefined} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} aria-invalid={!!formState.errors.confirm || undefined} />
        </Field>
        <Button type="submit" size="lg" className="mt-2" disabled={formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
