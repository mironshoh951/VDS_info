import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * The button primitive.
 *
 * `asChild` lets a link render with button styling without nesting an <a>
 * inside a <button> — which would be both invalid HTML and confusing to a
 * screen reader.
 *
 * Every variant keeps a visible focus ring and a minimum 44px touch target on
 * the sizes intended for primary actions (§57).
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium',
    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 shadow-xs',
        secondary:
          'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 shadow-xs',
        subtle: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
        ghost: 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
        link: 'text-primary-700 underline-offset-4 hover:underline p-0 h-auto',
        danger: 'bg-danger-500 text-white hover:bg-danger-700 shadow-xs',
        accent: 'bg-accent-600 text-white hover:bg-accent-700 shadow-xs',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button'
  return (
    <Component
      ref={ref}
      // An unspecified type on a button inside a form submits it. Default to
      // the safe choice and let callers opt in to "submit".
      {...(asChild ? {} : { type: type ?? 'button' })}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
})

export { buttonVariants }
