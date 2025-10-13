import React from 'react';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/**
 * Container that adapts its padding and max-width based on screen size
 * Following mobile-first principles
 */
export function ResponsiveContainer({
  children,
  className = '',
  size = 'lg'
}: ResponsiveContainerProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const sizeClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  };

  const paddingClasses = {
    mobile: 'px-4 py-3',
    tablet: 'px-6 py-4',
    desktop: 'px-8 py-6',
    large: 'px-12 py-8'
  };

  const responsivePadding = isMobile
    ? paddingClasses.mobile
    : isTablet
    ? paddingClasses.tablet
    : isDesktop
    ? paddingClasses.desktop
    : paddingClasses.large;

  return (
    <div className={cn(
      'w-full mx-auto',
      sizeClasses[size],
      responsivePadding,
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    large?: number;
  };
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
    large?: string;
  };
}

/**
 * Grid that automatically adjusts columns based on screen size
 * Mobile-first: defaults to 1 column on mobile
 */
export function ResponsiveGrid({
  children,
  className = '',
  cols = { mobile: 1, tablet: 2, desktop: 3, large: 4 },
  gap = { mobile: 'gap-3', tablet: 'gap-4', desktop: 'gap-6', large: 'gap-8' }
}: ResponsiveGridProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const getCols = () => {
    if (isMobile) return cols.mobile || 1;
    if (isTablet) return cols.tablet || 2;
    if (isDesktop) return cols.desktop || 3;
    return cols.large || 4;
  };

  const getGap = () => {
    if (isMobile) return gap.mobile || 'gap-3';
    if (isTablet) return gap.tablet || 'gap-4';
    if (isDesktop) return gap.desktop || 'gap-6';
    return gap.large || 'gap-8';
  };

  const gridCols = `grid-cols-${getCols()}`;
  const gridColsClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  };

  return (
    <div className={cn(
      'grid',
      gridColsClasses[getCols() as keyof typeof gridColsClasses] || 'grid-cols-1',
      getGap(),
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveFlexProps {
  children: React.ReactNode;
  className?: string;
  direction?: {
    mobile?: 'row' | 'col';
    tablet?: 'row' | 'col';
    desktop?: 'row' | 'col';
    large?: 'row' | 'col';
  };
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  gap?: string;
}

/**
 * Flex container that adapts direction and spacing based on screen size
 */
export function ResponsiveFlex({
  children,
  className = '',
  direction = { mobile: 'col', tablet: 'row', desktop: 'row', large: 'row' },
  justify = 'start',
  align = 'start',
  wrap = false,
  gap = 'gap-4'
}: ResponsiveFlexProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const getDirection = () => {
    if (isMobile) return direction.mobile || 'col';
    if (isTablet) return direction.tablet || 'row';
    if (isDesktop) return direction.desktop || 'row';
    return direction.large || 'row';
  };

  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col'
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  };

  return (
    <div className={cn(
      'flex',
      directionClasses[getDirection()],
      justifyClasses[justify],
      alignClasses[align],
      wrap && 'flex-wrap',
      gap,
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveTextProps {
  children: React.ReactNode;
  className?: string;
  size?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
    large?: string;
  };
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
}

/**
 * Text that adapts size based on screen size
 */
export function ResponsiveText({
  children,
  className = '',
  size = { mobile: 'text-sm', tablet: 'text-base', desktop: 'text-lg', large: 'text-xl' },
  weight = 'normal',
  align = 'left',
  color = ''
}: ResponsiveTextProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const getSize = () => {
    if (isMobile) return size.mobile || 'text-sm';
    if (isTablet) return size.tablet || 'text-base';
    if (isDesktop) return size.desktop || 'text-lg';
    return size.large || 'text-xl';
  };

  const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  };

  return (
    <p className={cn(
      getSize(),
      weightClasses[weight],
      alignClasses[align],
      color,
      className
    )}>
      {children}
    </p>
  );
}

interface ResponsiveButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: {
    mobile?: 'sm' | 'md' | 'lg';
    tablet?: 'sm' | 'md' | 'lg';
    desktop?: 'sm' | 'md' | 'lg';
    large?: 'sm' | 'md' | 'lg';
  };
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * Button that adapts size and padding for touch-friendly interaction
 */
export function ResponsiveButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = { mobile: 'md', tablet: 'md', desktop: 'md', large: 'md' },
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left'
}: ResponsiveButtonProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const getSize = () => {
    if (isMobile) return size.mobile || 'md';
    if (isTablet) return size.tablet || 'md';
    if (isDesktop) return size.desktop || 'md';
    return size.large || 'md';
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[44px]', // Touch-friendly minimum
    lg: 'px-6 py-3 text-lg min-h-[48px]'
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };

  const currentSize = getSize();

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation', // Better touch handling
        sizeClasses[currentSize],
        variantClasses[variant],
        className
      )}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
      )}
      {icon && iconPosition === 'left' && (
        <span className="mr-2">{icon}</span>
      )}
      {children}
      {icon && iconPosition === 'right' && (
        <span className="ml-2">{icon}</span>
      )}
    </button>
  );
}

interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
    large?: string;
  };
  hover?: boolean;
  interactive?: boolean;
}

/**
 * Card that adapts padding and behavior for different screen sizes
 */
export function ResponsiveCard({
  children,
  className = '',
  padding = { mobile: 'p-4', tablet: 'p-6', desktop: 'p-6', large: 'p-8' },
  hover = false,
  interactive = false
}: ResponsiveCardProps) {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  const getPadding = () => {
    if (isMobile) return padding.mobile || 'p-4';
    if (isTablet) return padding.tablet || 'p-6';
    if (isDesktop) return padding.desktop || 'p-6';
    return padding.large || 'p-8';
  };

  return (
    <div className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      getPadding(),
      hover && 'hover:shadow-md transition-shadow',
      interactive && 'cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]',
      className
    )}>
      {children}
    </div>
  );
}

// Utility for creating responsive className strings
export const createResponsiveClasses = (
  base: string,
  responsive: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  }
) => {
  let classes = base;

  Object.entries(responsive).forEach(([breakpoint, cls]) => {
    if (cls) {
      classes += ` ${breakpoint}:${cls}`;
    }
  });

  return classes;
};