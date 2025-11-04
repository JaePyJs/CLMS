import React, { createContext, useContext } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { cn } from '@/lib/utils';

/**
 * Compound component pattern for building flexible, composable UI components
 */

interface CompoundComponentContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

const CompoundComponentContext = createContext<CompoundComponentContextValue>({});

/**
 * Hook to access compound component context
 */
export function useCompoundComponent() {
  const context = useContext(CompoundComponentContext);
  if (!context) {
    throw new Error('Compound components must be used within a CompoundComponent.Provider');
  }
  return context;
}

/**
 * Base compound component interface
 */
export interface CompoundComponentProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

/**
 * Compound component provider
 */
export function CompoundComponentProvider({
  value,
  onValueChange,
  disabled = false,
  error,
  size = 'md',
  className,
  children,
}: CompoundComponentProps) {
  const contextValue: CompoundComponentContextValue = {
    ...(value !== undefined && { value }),
    ...(onValueChange && { onValueChange }),
    ...(disabled !== undefined && { disabled }),
    ...(error !== undefined && { error }),
    ...(size && { size }),
  };

  return (
    <CompoundComponentContext.Provider value={contextValue}>
      <div className={cn('compound-component', `size-${size}`, className)}>
        {children}
      </div>
    </CompoundComponentContext.Provider>
  );
}

/**
 * Sub-component interface
 */
export interface SubComponentProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Higher-order component to create sub-components
 */
export function createSubComponent<T extends SubComponentProps>(
  displayName: string,
  defaultClasses: string = ''
): ComponentType<T> {
  const SubComponent = ({ className, children, ...props }: T) => {
    const { disabled, error, size } = useCompoundComponent();

    const combinedClasses = cn(
      defaultClasses,
      `sub-component-${displayName.toLowerCase()}`,
      disabled && 'disabled',
      error && 'error',
      size && `size-${size}`,
      className
    );

    return (
      <div className={combinedClasses} {...props}>
        {children}
      </div>
    );
  };

  SubComponent.displayName = `CompoundComponent.${displayName}`;
  return SubComponent as ComponentType<T>;
}

/**
 * Interactive sub-component (like tabs, buttons, etc.)
 */
export interface InteractiveSubComponentProps extends SubComponentProps {
  value: string;
  active?: boolean;
}

export function createInteractiveSubComponent<T extends InteractiveSubComponentProps>(
  displayName: string,
  defaultClasses: string = ''
): ComponentType<T> {
  const InteractiveSubComponent = ({
    value,
    active = false,
    className,
    children,
    ...props
  }: T) => {
    const { onValueChange, disabled, size } = useCompoundComponent();

    const handleClick = () => {
      if (!disabled && onValueChange) {
        onValueChange(value);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ') && onValueChange) {
        e.preventDefault();
        onValueChange(value);
      }
    };

    const combinedClasses = cn(
      defaultClasses,
      `interactive-sub-component-${displayName.toLowerCase()}`,
      active && 'active',
      disabled && 'disabled',
      size && `size-${size}`,
      'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500',
      className
    );

    return (
      <div
        className={combinedClasses}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-pressed={active}
        aria-disabled={disabled}
        {...props}
      >
        {children}
      </div>
    );
  };

  InteractiveSubComponent.displayName = `CompoundComponent.${displayName}`;
  return InteractiveSubComponent as ComponentType<T>;
}

/**
 * Content sub-component (conditional rendering)
 */
export interface ContentSubComponentProps extends SubComponentProps {
  when?: string | boolean;
  show?: boolean;
}

export function createContentSubComponent<T extends ContentSubComponentProps>(
  displayName: string,
  defaultClasses: string = ''
): ComponentType<T> {
  const ContentSubComponent = ({
    when,
    show = true,
    className,
    children,
    ...props
  }: T) => {
    const { value } = useCompoundComponent();

    const shouldShow = show && (
      when === undefined ||
      (typeof when === 'boolean' && when) ||
      (typeof when === 'string' && when === value)
    );

    if (!shouldShow) {
      return null;
    }

    const combinedClasses = cn(
      defaultClasses,
      `content-sub-component-${displayName.toLowerCase()}`,
      className
    );

    return (
      <div className={combinedClasses} {...props}>
        {children}
      </div>
    );
  };

  ContentSubComponent.displayName = `CompoundComponent.${displayName}`;
  return ContentSubComponent as ComponentType<T>;
}

/**
 * Utility to build compound components
 */
export function createCompoundComponent<T extends Record<string, ComponentType<any>>>(
  name: string,
  subComponents: T,
  Provider: ComponentType<CompoundComponentProps> = CompoundComponentProvider
) {
  const Compound = Object.assign(Provider, subComponents);
  Compound.displayName = name;

  return Compound as typeof Compound & T;
}

/**
 * Example: Creating a Tab component using the compound pattern
 */
export const Tab = createCompoundComponent('Tab', {
  Root: CompoundComponentProvider,

  List: createSubComponent('TabList', 'flex border-b border-gray-200'),

  Trigger: createInteractiveSubComponent(
    'TabTrigger',
    'px-4 py-2 border-b-2 border-transparent hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
  ),

  Content: createContentSubComponent(
    'TabContent',
    'p-4 focus:outline-none'
  ),
});

/**
 * Example: Creating an Accordion component using the compound pattern
 */
export const Accordion = createCompoundComponent('Accordion', {
  Root: CompoundComponentProvider,

  Item: createSubComponent('AccordionItem', 'border border-gray-200 rounded-lg mb-2'),

  Trigger: createInteractiveSubComponent(
    'AccordionTrigger',
    'w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
  ),

  Content: createContentSubComponent(
    'AccordionContent',
    'px-4 py-3 border-t border-gray-200'
  ),
});

/**
 * Example: Creating a Card component using the compound pattern
 */
export const Card = createCompoundComponent('Card', {
  Root: createSubComponent('CardRoot', 'bg-white border border-gray-200 rounded-lg shadow-sm'),

  Header: createSubComponent('CardHeader', 'px-6 py-4 border-b border-gray-200'),

  Title: createSubComponent('CardTitle', 'text-lg font-semibold text-gray-900'),

  Description: createSubComponent('CardDescription', 'text-sm text-gray-600 mt-1'),

  Content: createSubComponent('CardContent', 'px-6 py-4'),

  Footer: createSubComponent('CardFooter', 'px-6 py-4 border-t border-gray-200 bg-gray-50'),
});

export default CompoundComponentProvider;
