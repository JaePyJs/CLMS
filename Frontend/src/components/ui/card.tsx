import * as React from 'react';

import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to enable the border glow effect */
  enableGlow?: boolean;
  /** Primary glow color */
  glowColor?: string;
  /** Secondary glow color */
  glowColorSecondary?: string;
  /** Glow size in pixels */
  glowSize?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      enableGlow = true,
      glowColor = '#3b82f6',
      glowColorSecondary = '#06b6d4',
      glowSize = 180,
      children,
      ...props
    },
    ref
  ) => {
    const cardRef = React.useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = React.useState(false);

    React.useImperativeHandle(ref, () => cardRef.current!);

    const handleMouseMove = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !enableGlow) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      },
      [enableGlow]
    );

    return (
      <div
        ref={cardRef}
        className={cn(
          'relative rounded-xl border bg-card text-card-foreground shadow-sm',
          'transition-shadow duration-200 ease-in-out',
          'hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-primary/5',
          'dark:border-border/50',
          className
        )}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {/* Border glow effect - follows cursor on edges */}
        {enableGlow && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `
                radial-gradient(
                  ${glowSize}px circle at ${mousePos.x}px ${mousePos.y}px,
                  ${glowColor},
                  ${glowColorSecondary} 40%,
                  transparent 70%
                )
              `,
              WebkitMask: `
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0)
              `,
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 250ms ease',
            }}
          />
        )}
        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
