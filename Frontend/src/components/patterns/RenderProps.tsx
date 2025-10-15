import React, { ReactNode, ComponentType, ReactElement } from 'react';

/**
 * Render prop patterns for flexible component composition
 */

/**
 * Basic render prop interface
 */
export interface RenderProps<T = unknown> {
  children: ((data: T) => ReactNode) | ReactNode;
}

/**
 * State render prop interface
 */
export interface StateRenderProps<T, S = unknown> {
  children: ((state: S, actions: T) => ReactNode) | ReactNode;
}

/**
 * Enhanced render prop with multiple render functions
 */
export interface MultiRenderProps<T = unknown> {
  render?: (data: T) => ReactNode;
  children?: ((data: T) => ReactNode) | ReactNode;
  component?: ComponentType<T>;
}

/**
 * Data provider with render prop
 */
export interface DataProviderProps<T> {
  data: T;
  children: ((data: T) => ReactNode) | ReactNode;
  render?: (data: T) => ReactNode;
  component?: ComponentType<T>;
}

export function DataProvider<T>({ data, children, render, component: Component }: DataProviderProps<T>) {
  const renderFunction = render || (typeof children === 'function' ? children : undefined);
  const ChildComponent = Component || (typeof children === 'object' ? children as ComponentType<T> : undefined);

  if (renderFunction) {
    return <>{renderFunction(data)}</>;
  }

  if (ChildComponent) {
    return <ChildComponent {...data} />;
  }

  if (typeof children !== 'function') {
    return <>{children}</>;
  }

  return null;
}

/**
 * Async data provider with render props
 */
export interface AsyncDataProviderProps<T> {
  fetcher: () => Promise<T>;
  initialData?: T;
  children: (data: {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  }) => ReactNode;
  render?: (data: {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  }) => ReactNode;
}

export function AsyncDataProvider<T>({ fetcher, initialData, children, render }: AsyncDataProviderProps<T>) {
  const [data, setData] = React.useState<T | undefined>(initialData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  React.useEffect(() => {
    if (initialData === undefined) {
      fetchData();
    }
  }, [fetchData, initialData]);

  const renderData = {
    data,
    loading,
    error,
    refetch: fetchData,
  };

  const renderFunction = render || children;
  return <>{renderFunction(renderData)}</>;
}

/**
 * Toggle provider with render props
 */
export interface ToggleProviderProps {
  initialOn?: boolean;
  children: (data: {
    on: boolean;
    toggle: () => void;
    setOn: (on: boolean) => void;
    setOff: () => void;
  }) => ReactNode;
  render?: (data: {
    on: boolean;
    toggle: () => void;
    setOn: (on: boolean) => void;
    setOff: () => void;
  }) => ReactNode;
}

export function ToggleProvider({ initialOn = false, children, render }: ToggleProviderProps) {
  const [on, setOn] = React.useState(initialOn);

  const toggle = React.useCallback(() => {
    setOn(prev => !prev);
  }, []);

  const setOnState = React.useCallback((newOn: boolean) => {
    setOn(newOn);
  }, []);

  const setOff = React.useCallback(() => {
    setOn(false);
  }, []);

  const renderData = {
    on,
    toggle,
    setOn: setOnState,
    setOff,
  };

  const renderFunction = render || children;
  return <>{renderFunction(renderData)}</>;
}

/**
 * Counter provider with render props
 */
export interface CounterProviderProps {
  initialCount?: number;
  step?: number;
  min?: number;
  max?: number;
  children: (data: {
    count: number;
    increment: () => void;
    decrement: () => void;
    setCount: (count: number) => void;
    reset: () => void;
    canIncrement: boolean;
    canDecrement: boolean;
  }) => ReactNode;
  render?: (data: {
    count: number;
    increment: () => void;
    decrement: () => void;
    setCount: (count: number) => void;
    reset: () => void;
    canIncrement: boolean;
    canDecrement: boolean;
  }) => ReactNode;
}

export function CounterProvider({
  initialCount = 0,
  step = 1,
  min,
  max,
  children,
  render,
}: CounterProviderProps) {
  const [count, setCount] = React.useState(initialCount);

  const increment = React.useCallback(() => {
    setCount(prev => {
      const newValue = prev + step;
      return max !== undefined ? Math.min(newValue, max) : newValue;
    });
  }, [step, max]);

  const decrement = React.useCallback(() => {
    setCount(prev => {
      const newValue = prev - step;
      return min !== undefined ? Math.max(newValue, min) : newValue;
    });
  }, [step, min]);

  const setCountValue = React.useCallback((newCount: number) => {
    let validatedCount = newCount;
    if (min !== undefined) validatedCount = Math.max(validatedCount, min);
    if (max !== undefined) validatedCount = Math.min(validatedCount, max);
    setCount(validatedCount);
  }, [min, max]);

  const reset = React.useCallback(() => {
    setCount(initialCount);
  }, [initialCount]);

  const canIncrement = max === undefined || count < max;
  const canDecrement = min === undefined || count > min;

  const renderData = {
    count,
    increment,
    decrement,
    setCount: setCountValue,
    reset,
    canIncrement,
    canDecrement,
  };

  const renderFunction = render || children;
  return <>{renderFunction(renderData)}</>;
}

/**
 * List provider with render props
 */
export interface ListProviderProps<T> {
  items: T[];
  children: (data: {
    items: T[];
    map: <U>(callback: (item: T, index: number) => U) => U[];
    filter: (predicate: (item: T, index: number) => boolean) => T[];
    reduce: <U>(callback: (accumulator: U, item: T, index: number) => U, initialValue: U) => U;
    find: (predicate: (item: T, index: number) => boolean) => T | undefined;
    some: (predicate: (item: T, index: number) => boolean) => boolean;
    every: (predicate: (item: T, index: number) => boolean) => boolean;
    length: number;
    isEmpty: boolean;
    first: T | undefined;
    last: T | undefined;
  }) => ReactNode;
  render?: (data: {
    items: T[];
    map: <U>(callback: (item: T, index: number) => U) => U[];
    filter: (predicate: (item: T, index: number) => boolean) => T[];
    reduce: <U>(callback: (accumulator: U, item: T, index: number) => U, initialValue: U) => U;
    find: (predicate: (item: T, index: number) => boolean) => T | undefined;
    some: (predicate: (item: T, index: number) => boolean) => boolean;
    every: (predicate: (item: T, index: number) => boolean) => boolean;
    length: number;
    isEmpty: boolean;
    first: T | undefined;
    last: T | undefined;
  }) => ReactNode;
}

export function ListProvider<T>({ items, children, render }: ListProviderProps<T>) {
  const renderData = {
    items,
    map: React.useCallback(<U>(callback: (item: T, index: number) => U) =>
      items.map(callback), [items]),
    filter: React.useCallback((predicate: (item: T, index: number) => boolean) =>
      items.filter(predicate), [items]),
    reduce: React.useCallback(<U>(callback: (accumulator: U, item: T, index: number) => U, initialValue: U) =>
      items.reduce(callback, initialValue), [items]),
    find: React.useCallback((predicate: (item: T, index: number) => boolean) =>
      items.find(predicate), [items]),
    some: React.useCallback((predicate: (item: T, index: number) => boolean) =>
      items.some(predicate), [items]),
    every: React.useCallback((predicate: (item: T, index: number) => boolean) =>
      items.every(predicate), [items]),
    length: items.length,
    isEmpty: items.length === 0,
    first: items[0],
    last: items[items.length - 1],
  };

  const renderFunction = render || children;
  return <>{renderFunction(renderData)}</>;
}

/**
 * Form provider with render props
 */
export interface FormProviderProps<T> {
  initialValues: T;
  children: (data: {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isDirty: boolean;
    setValue: <K extends keyof T>(field: K, value: T[K]) => void;
    setError: <K extends keyof T>(field: K, error: string) => void;
    setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;
    validate: () => boolean;
    reset: () => void;
    handleSubmit: (onSubmit: (values: T) => void) => (e: React.FormEvent) => void;
  }) => ReactNode;
  render?: (data: {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isDirty: boolean;
    setValue: <K extends keyof T>(field: K, value: T[K]) => void;
    setError: <K extends keyof T>(field: K, error: string) => void;
    setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;
    validate: () => boolean;
    reset: () => void;
    handleSubmit: (onSubmit: (values: T) => void) => (e: React.FormEvent) => void;
  }) => ReactNode;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
}

export function FormProvider<T extends Record<string, any>>({
  initialValues,
  children,
  render,
  validate,
}: FormProviderProps<T>) {
  const [values, setValues] = React.useState<T>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = React.useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = React.useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const setError = React.useCallback(<K extends keyof T>(field: K, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const setTouchedField = React.useCallback(<K extends keyof T>(field: K, touchedValue: boolean = true) => {
    setTouched(prev => ({ ...prev, [field]: touchedValue }));
  }, []);

  const validateForm = React.useCallback(() => {
    const newErrors = validate ? validate(values) : {};
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validate]);

  const reset = React.useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const handleSubmit = React.useCallback((onSubmit: (values: T) => void) => {
    return (e: React.FormEvent) => {
      e.preventDefault();
      if (validateForm()) {
        onSubmit(values);
      }
    };
  }, [values, validateForm]);

  const isValid = Object.keys(errors).length === 0;
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  const renderData = {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    setValue,
    setError,
    setTouched: setTouchedField,
    validate: validateForm,
    reset,
    handleSubmit,
  };

  const renderFunction = render || children;
  return <>{renderFunction(renderData)}</>;
}

/**
 * Higher-order component that converts a component to use render props
 */
export function withRenderProps<T extends Record<string, any>>(
  Component: ComponentType<T>,
  propName: string = 'children'
) {
  return function WithRenderProps(props: Omit<T, typeof propName> & { [key: string]: any }) {
    const { [propName]: children, ...rest } = props;

    if (typeof children === 'function') {
      return <>{children(rest as T)}</>;
    }

    return <Component {...(rest as T)} />;
  };
}

/**
 * Utility to determine if a prop is a render function
 */
export function isRenderFunction(prop: any): prop is Function {
  return typeof prop === 'function';
}

/**
 * Utility to get the render function from props
 */
export function getRenderFunction<T = unknown>(
  props: RenderProps<T> | MultiRenderProps<T>
): ((data: T) => ReactNode) | null {
  if ('render' in props && typeof props.render === 'function') {
    return props.render;
  }

  if ('children' in props && typeof props.children === 'function') {
    return props.children;
  }

  return null;
}

export default DataProvider;