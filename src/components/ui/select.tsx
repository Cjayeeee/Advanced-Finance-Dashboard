import * as React from 'react'
import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fieldBase } from './input'

export interface SelectOption {
  value: string
  label: React.ReactNode
  hint?: string
  disabled?: boolean
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  id,
  className,
  triggerClassName,
  invalid,
  disabled,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  value?: string
  onValueChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  id?: string
  className?: string
  triggerClassName?: string
  invalid?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  'aria-label'?: string
}) {
  return (
    <S.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          'flex items-center justify-between gap-2 text-left data-[placeholder]:text-subtle',
          size === 'sm' ? 'h-9 rounded-full px-3.5 text-[13px]' : 'h-11',
          triggerClassName,
          className,
        )}
      >
        <span className="truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <ChevronDown className="size-4 text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-[80] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl bg-paper/95 p-1.5 shadow-[var(--shadow-pop)] ring-1 ring-line backdrop-blur-xl animate-pop"
        >
          <S.Viewport className="scrollbar-thin">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-xl py-2 pl-3 pr-8 text-[13.5px] text-ink-3 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-ink/5 data-[highlighted]:text-ink data-[state=checked]:font-medium data-[state=checked]:text-ink"
              >
                <S.ItemText>{o.label}</S.ItemText>
                {o.hint && <span className="ml-auto text-xs text-subtle">{o.hint}</span>}
                <S.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
