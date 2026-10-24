import * as React from 'react'
import { cn } from '@/lib/utils'

export const fieldBase =
  'w-full rounded-[var(--radius-field)] bg-white/75 px-3.5 text-[14px] text-ink placeholder:text-subtle ring-1 ring-line-strong transition-[box-shadow,background-color] duration-150 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink aria-[invalid=true]:ring-loss aria-[invalid=true]:ring-2 disabled:opacity-50'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-20 py-2.5 leading-relaxed resize-y', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-ink-3', className)} {...props} />
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
  optional,
}: {
  label: React.ReactNode
  htmlFor: string
  error?: string
  hint?: React.ReactNode
  className?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-subtle">optional</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12.5px] text-loss animate-fade">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Currency-prefixed amount input; keeps raw string so users can type freely. */
export const MoneyInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { symbol: string; large?: boolean }>(
  ({ symbol, large, className, ...props }, ref) => (
    <div className="relative">
      <span className={cn('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted', large && 'left-4 text-2xl font-light font-display')}>{symbol}</span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn(fieldBase, 'h-11 pl-8 num', large && 'h-16 pl-10 text-3xl font-display font-light tracking-tight', className)}
        {...props}
      />
    </div>
  ),
)
MoneyInput.displayName = 'MoneyInput'
