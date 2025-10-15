import React, { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Base component props that all components should extend
 */
export interface BaseComponentProps {
  /** CSS class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Additional ARIA attributes */
  aria?: Record<string, string>;
  /** Children components */
  children?: ReactNode;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether the component is loading */
  loading?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

/**
 * Higher-order component that adds base functionality to any component
 */
export function withBaseComponent<T extends BaseComponentProps>(
  WrappedComponent: ComponentType<T>
): ComponentType<T> {
  const WithBaseComponent = (props: T) => {
    const {
      className,
      testId,
      ariaLabel,
      aria,
      disabled,
      loading,
      size = 'md',
      variant = 'primary',
      ...rest
    } = props;

    const baseClasses = cn(
      'base-component',
      disabled && 'opacity-50 cursor-not-allowed',
      loading && 'animate-pulse',
      size && `size-${size}`,
      variant && `variant-${variant}`,
      className
    );

    const baseAria = {
      'aria-label': ariaLabel,
      'aria-disabled': disabled,
      'aria-busy': loading,
      ...aria,
    };

    return (
      <WrappedComponent
        {...(rest as T)}
        className={baseClasses}
        data-testid={testId}
        {...baseAria}
      />
    );
  };

  WithBaseComponent.displayName = `withBaseComponent(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithBaseComponent;
}

/**
 * Base component class that provides common functionality
 */
export abstract class BaseComponent<P extends BaseComponentProps = BaseComponentProps> {
  protected props: P;
  protected element?: HTMLElement;

  constructor(props: P) {
    this.props = props;
  }

  /**
   * Mount the component
   */
  mount(element: HTMLElement): void {
    this.element = element;
    this.onMount();
  }

  /**
   * Unmount the component
   */
  unmount(): void {
    this.onUnmount();
    this.element = undefined;
  }

  /**
   * Update component props
   */
  update(props: Partial<P>): void {
    this.props = { ...this.props, ...props };
    this.onUpdate();
  }

  /**
   * Get computed CSS classes
   */
  protected getClasses(): string {
    const { className, disabled, loading, size, variant } = this.props;

    return cn(
      'base-component',
      disabled && 'disabled',
      loading && 'loading',
      size && `size-${size}`,
      variant && `variant-${variant}`,
      className
    );
  }

  /**
   * Get ARIA attributes
   */
  protected getAriaAttributes(): Record<string, string> {
    const { ariaLabel, aria, disabled, loading } = this.props;

    return {
      'aria-label': ariaLabel || '',
      'aria-disabled': disabled ? 'true' : 'false',
      'aria-busy': loading ? 'true' : 'false',
      ...aria,
    };
  }

  /**
   * Lifecycle hook for when component mounts
   */
  protected onMount(): void {
    // Override in subclasses
  }

  /**
   * Lifecycle hook for when component unmounts
   */
  protected onUnmount(): void {
    // Override in subclasses
  }

  /**
   * Lifecycle hook for when component updates
   */
  protected onUpdate(): void {
    // Override in subclasses
  }

  /**
   * Render the component
   */
  abstract render(): string | HTMLElement;
}

/**
 * Utility function to create consistent component variants
 */
export function createComponentVariants<T extends Record<string, string>>(
  base: string,
  variants: T
): T {
  const result = {} as T;

  Object.entries(variants).forEach(([key, value]) => {
    (result as any)[key] = `${base} ${value}`;
  });

  return result;
}

/**
 * Size variants for components
 */
export const sizeVariants = {
  sm: 'size-sm',
  md: 'size-md',
  lg: 'size-lg',
  xl: 'size-xl',
} as const;

/**
 * Color variants for components
 */
export const colorVariants = {
  primary: 'variant-primary',
  secondary: 'variant-secondary',
  success: 'variant-success',
  warning: 'variant-warning',
  error: 'variant-error',
  info: 'variant-info',
} as const;

/**
 * State variants for components
 */
export const stateVariants = {
  default: 'state-default',
  hover: 'state-hover',
  active: 'state-active',
  focus: 'state-focus',
  disabled: 'state-disabled',
  loading: 'state-loading',
} as const;

/**
 * Common component patterns
 */
export const ComponentPatterns = {
  /**
   * Create a clickable component that handles keyboard and mouse events
   */
  clickable: (onClick: () => void) => ({
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    onClick,
  }),

  /**
   * Create a focusable component with proper focus management
   */
  focusable: (onFocus?: () => void, onBlur?: () => void) => ({
    tabIndex: 0,
    onFocus,
    onBlur,
  }),

  /**
   * Create a loading state component
   */
  loading: (isLoading: boolean, children: ReactNode) => ({
    'aria-busy': isLoading,
    children: isLoading ? (
      <div className="loading-spinner" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
      </div>
    ) : children,
  }),

  /**
   * Create an error boundary component
   */
  errorBoundary: (error: Error | null, errorComponent?: ReactNode) => {
    if (error) {
      return errorComponent || (
        <div className="error-boundary" role="alert">
          <p>Something went wrong.</p>
          <details>
            <summary>Error details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      );
    }
    return null;
  },
};

export default BaseComponent;