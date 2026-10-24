import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none transition-[background-color,color,box-shadow,transform,opacity] duration-200 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-ink-3 shadow-[0_6px_16px_-8px_rgb(22_22_21/0.6)]',
        sun: 'bg-sun text-ink hover:bg-sun-deep shadow-[0_6px_16px_-8px_rgb(226_180_28/0.8)]',
        secondary: 'bg-white/80 text-ink hover:bg-white shadow-[0_1px_2px_rgb(22_22_21/0.06)] ring-1 ring-line',
        outline: 'bg-transparent text-ink ring-1 ring-line-strong hover:bg-white/60',
        ghost: 'bg-transparent text-ink-3 hover:bg-ink/5 hover:text-ink',
        danger: 'bg-loss text-white hover:bg-loss/90',
        'ghost-inverse': 'bg-white/10 text-white hover:bg-white/20',
        link: 'bg-transparent px-0 text-ink underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm: 'h-8 px-3.5 text-[13px]',
        md: 'h-10 px-4.5 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, type, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
