import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Solid buttons: use brightness for hover (works in both light/dark mode)
        default:
          'bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:brightness-110',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:shadow-md hover:brightness-110',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:shadow hover:brightness-105',
        // Outline: subtle blue tint on hover (adds color, doesn't reduce it)
        outline:
          'border border-input bg-transparent text-foreground hover:bg-blue-500/10 dark:hover:bg-blue-400/15 hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-400',
        // Ghost: very subtle background on hover
        ghost:
          'text-foreground hover:bg-accent/50 dark:hover:bg-accent/30 hover:text-accent-foreground',
        // Link: simple underline
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
