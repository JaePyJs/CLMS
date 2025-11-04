import React from 'react';
import type { ReactNode, ComponentType } from 'react';

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
  
  // Only use Component prop, don't try to cast children to ComponentType
  const ChildComponent = Component;

  if (renderFunction) {
    return React.createElement(React.Fragment, null, renderFunction(data));
  }

  if (ChildComponent) {
    // Ensure data is treated as props object
    const props = typeof data === 'object' && data !== null ? data : { data } as any;
    return React.createElement(ChildComponent as any, props);
  }

  if (typeof children !== 'function') {
    return React.createElement(React.Fragment, null, children);
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
  return React.createElement(React.Fragment, null, renderFunction(renderData));
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
  return React.createElement(React.Fragment, null, renderFunction(renderData));
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
  return React.createElement(React.Fragment, null, renderFunction(renderData));
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
  const mapCallback = React.useCallback(<U>(callback: (item: T, index: number) => U): U[] =>
    items.map(callback), [items]);

  const filterCallback = React.useCallback((predicate: (item: T, index: number) => boolean): T[] =>
    items.filter(predicate), [items]);

  const reduceCallback = React.useCallback(<U>(callback: (accumulator: U, item: T, index: number) => U, initialValue: U): U =>
    items.reduce(callback, initialValue), [items]);

  const findCallback = React.useCallback((predicate: (item: T, index: number) => boolean): T | undefined =>
    items.find(predicate), [items]);

  const someCallback = React.useCallback((predicate: (item: T, index: number) => boolean): boolean =>
    items.some(predicate), [items]);

  const everyCallback = React.useCallback((predicate: (item: T, index: number) => boolean): boolean =>
    items.every(predicate), [items]);

  const renderData = {
    items,
    map: mapCallback,
    filter: filterCallback,
    reduce: reduceCallback,
    find: findCallback,
    some: someCallback,
    every: everyCallback,
    length: items.length,
    isEmpty: items.length === 0,
    first: items[0],
    last: items[items.length - 1],
  };

  const renderFunction = render || children;
  return React.createElement(React.Fragment, null, renderFunction(renderData));
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

  const setValueCallback = React.useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const setErrorCallback = React.useCallback(<K extends keyof T>(field: K, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const setTouchedFieldCallback = React.useCallback(<K extends keyof T>(field: K, touchedValue: boolean = true) => {
    setTouched(prev => ({ ...prev, [field]: touchedValue }));
  }, []);

  const validateFormCallback = React.useCallback(() => {
    const newErrors = validate ? validate(values) : {};
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validate]);

  const resetCallback = React.useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const handleSubmitCallback = React.useCallback((onSubmit: (values: T) => void) => {
    return (e: React.FormEvent) => {
      e.preventDefault();
      if (validateFormCallback()) {
        onSubmit(values);
      }
    };
  }, [values, validateFormCallback]);

  const isValid = Object.keys(errors).length === 0;
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  const renderData = {
    values,
    errors,
    touched,
    isValid,
    isDirty,
    setValue: setValueCallback,
    setError: setErrorCallback,
    setTouched: setTouchedFieldCallback,
    validate: validateFormCallback,
    reset: resetCallback,
    handleSubmit: handleSubmitCallback,
  };

  const renderFunction = render || children;
  return React.createElement(React.Fragment, null, renderFunction(renderData));
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
      return React.createElement(React.Fragment, null, children(rest as T));
    }

    return React.createElement(Component, rest as T);
  };
}

/**
 * Utility to determine if a prop is a render function
 */
export function isRenderFunction(prop: any): prop is (...args: any[]) => any {
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
