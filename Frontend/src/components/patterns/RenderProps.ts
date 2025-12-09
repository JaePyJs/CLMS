import React, { type ReactNode, type ComponentType } from 'react';

/**
 * Render prop patterns for flexible component composition
 */

/**
 * Basic render prop interface
 */
export interface RenderProps<T = unknown> {
  children: ((_data: T) => ReactNode) | ReactNode;
}

/**
 * State render prop interface
 */
export interface StateRenderProps<T, S = unknown> {
  children: ((_state: S, _actions: T) => ReactNode) | ReactNode;
}

/**
 * Enhanced render prop with multiple render functions
 */
export interface MultiRenderProps<T = unknown> {
  render?: (_data: T) => ReactNode;
  children?: ((_data: T) => ReactNode) | ReactNode;
  component?: ComponentType<T>;
}

/**
 * Data provider with render prop
 */
export interface DataProviderProps<T> {
  data: T;
  children: ((_data: T) => ReactNode) | ReactNode;
  render?: (_data: T) => ReactNode;
  component?: ComponentType<T>;
}

export function DataProvider<T>({
  data,
  children,
  render,
  component: Component,
}: DataProviderProps<T>) {
  const renderFunction =
    render || (typeof children === 'function' ? children : undefined);

  // Only use Component prop, don't try to cast children to ComponentType
  const ChildComponent = Component;

  if (renderFunction) {
    return React.createElement(React.Fragment, null, renderFunction(data));
  }

  if (ChildComponent) {
    // Ensure data is treated as props object
    const props =
      typeof data === 'object' && data !== null ? data : ({ data } as any);
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
  children: (_data: {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  }) => ReactNode;
  render?: (_data: {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  }) => ReactNode;
}

export function AsyncDataProvider<T>({
  fetcher,
  initialData,
  children,
  render,
}: AsyncDataProviderProps<T>) {
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
  children: (_data: {
    on: boolean;
    toggle: () => void;
    setOn: (_on: boolean) => void;
    setOff: () => void;
  }) => ReactNode;
  render?: (_data: {
    on: boolean;
    toggle: () => void;
    setOn: (_on: boolean) => void;
    setOff: () => void;
  }) => ReactNode;
}

export function ToggleProvider({
  initialOn = false,
  children,
  render,
}: ToggleProviderProps) {
  const [on, setOn] = React.useState(initialOn);

  const toggle = React.useCallback(() => {
    setOn((prev) => !prev);
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
  children: (_data: {
    count: number;
    increment: () => void;
    decrement: () => void;
    setCount: (_count: number) => void;
    reset: () => void;
    canIncrement: boolean;
    canDecrement: boolean;
  }) => ReactNode;
  render?: (_data: {
    count: number;
    increment: () => void;
    decrement: () => void;
    setCount: (_count: number) => void;
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
    setCount((prev) => {
      const newValue = prev + step;
      return max !== undefined ? Math.min(newValue, max) : newValue;
    });
  }, [step, max]);

  const decrement = React.useCallback(() => {
    setCount((prev) => {
      const newValue = prev - step;
      return min !== undefined ? Math.max(newValue, min) : newValue;
    });
  }, [step, min]);

  const setCountValue = React.useCallback(
    (newCount: number) => {
      let validatedCount = newCount;
      if (min !== undefined) {
        validatedCount = Math.max(validatedCount, min);
      }
      if (max !== undefined) {
        validatedCount = Math.min(validatedCount, max);
      }
      setCount(validatedCount);
    },
    [min, max]
  );

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
  children: (_data: {
    items: T[];
    map: <U>(_callback: (_item: T, _index: number) => U) => U[];
    filter: (_predicate: (_item: T, _index: number) => boolean) => T[];
    reduce: <U>(
      _callback: (_accumulator: U, _item: T, _index: number) => U,
      _initialValue: U
    ) => U;
    find: (_predicate: (_item: T, _index: number) => boolean) => T | undefined;
    some: (_predicate: (_item: T, _index: number) => boolean) => boolean;
    every: (_predicate: (_item: T, _index: number) => boolean) => boolean;
    length: number;
    isEmpty: boolean;
    first: T | undefined;
    last: T | undefined;
  }) => ReactNode;
  render?: (_data: {
    items: T[];
    map: <U>(_callback: (_item: T, _index: number) => U) => U[];
    filter: (_predicate: (_item: T, _index: number) => boolean) => T[];
    reduce: <U>(
      _callback: (_accumulator: U, _item: T, _index: number) => U,
      _initialValue: U
    ) => U;
    find: (_predicate: (_item: T, _index: number) => boolean) => T | undefined;
    some: (_predicate: (_item: T, _index: number) => boolean) => boolean;
    every: (_predicate: (_item: T, _index: number) => boolean) => boolean;
    length: number;
    isEmpty: boolean;
    first: T | undefined;
    last: T | undefined;
  }) => ReactNode;
}

export function ListProvider<T>({
  items,
  children,
  render,
}: ListProviderProps<T>) {
  const mapCallback = React.useCallback(
    <U>(_callback: (_item: T, _index: number) => U): U[] =>
      items.map(_callback),
    [items]
  );

  const filterCallback = React.useCallback(
    (_predicate: (_item: T, _index: number) => boolean): T[] =>
      items.filter(_predicate),
    [items]
  );

  const reduceCallback = React.useCallback(
    <U>(
      _callback: (_accumulator: U, _item: T, _index: number) => U,
      _initialValue: U
    ): U => items.reduce(_callback, _initialValue),
    [items]
  );

  const findCallback = React.useCallback(
    (_predicate: (_item: T, _index: number) => boolean): T | undefined =>
      items.find(_predicate),
    [items]
  );

  const someCallback = React.useCallback(
    (_predicate: (_item: T, _index: number) => boolean): boolean =>
      items.some(_predicate),
    [items]
  );

  const everyCallback = React.useCallback(
    (_predicate: (_item: T, _index: number) => boolean): boolean =>
      items.every(_predicate),
    [items]
  );

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
  children: (_data: {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isDirty: boolean;
    setValue: <K extends keyof T>(_field: K, _value: T[K]) => void;
    setError: <K extends keyof T>(_field: K, _error: string) => void;
    setTouched: <K extends keyof T>(_field: K, _touched?: boolean) => void;
    validate: () => boolean;
    reset: () => void;
    handleSubmit: (
      _onSubmit: (_values: T) => void
    ) => (_e: React.FormEvent) => void;
  }) => ReactNode;
  render?: (_data: {
    values: T;
    errors: Partial<Record<keyof T, string>>;
    touched: Partial<Record<keyof T, boolean>>;
    isValid: boolean;
    isDirty: boolean;
    setValue: <K extends keyof T>(_field: K, _value: T[K]) => void;
    setError: <K extends keyof T>(_field: K, _error: string) => void;
    setTouched: <K extends keyof T>(_field: K, _touched?: boolean) => void;
    validate: () => boolean;
    reset: () => void;
    handleSubmit: (
      _onSubmit: (_values: T) => void
    ) => (_e: React.FormEvent) => void;
  }) => ReactNode;
  validate?: (_values: T) => Partial<Record<keyof T, string>>;
}

export function FormProvider<T extends Record<string, any>>({
  initialValues,
  children,
  render,
  validate,
}: FormProviderProps<T>) {
  const [values, setValues] = React.useState<T>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>(
    {}
  );
  const [touched, setTouched] = React.useState<
    Partial<Record<keyof T, boolean>>
  >({});

  const setValueCallback = React.useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    []
  );

  const setErrorCallback = React.useCallback(
    <K extends keyof T>(field: K, error: string) => {
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    []
  );

  const setTouchedFieldCallback = React.useCallback(
    <K extends keyof T>(field: K, touchedValue: boolean = true) => {
      setTouched((prev) => ({ ...prev, [field]: touchedValue }));
    },
    []
  );

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

  const handleSubmitCallback = React.useCallback(
    (_onSubmit: (_values: T) => void) => {
      return (e: React.FormEvent) => {
        e.preventDefault();
        if (validateFormCallback()) {
          _onSubmit(values);
        }
      };
    },
    [values, validateFormCallback]
  );

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
export function withRenderProps<T extends Record<string, unknown>>(
  Component: ComponentType<T>,
  _propName: string = 'children'
) {
  return function WithRenderProps(
    props: Omit<T, typeof _propName> & { [key: string]: unknown }
  ) {
    const { [_propName]: children, ...rest } = props;

    if (typeof children === 'function') {
      return React.createElement(React.Fragment, null, children(rest as T));
    }

    return React.createElement(Component, rest as T);
  };
}

/**
 * Utility to determine if a prop is a render function
 */
export function isRenderFunction(
  prop: unknown
): prop is (..._args: unknown[]) => unknown {
  return typeof prop === 'function';
}

/**
 * Utility to get the render function from props
 */
export function getRenderFunction<T = unknown>(
  props: RenderProps<T> | MultiRenderProps<T>
): ((_data: T) => ReactNode) | null {
  if ('render' in props && typeof props.render === 'function') {
    return props.render;
  }

  if ('children' in props && typeof props.children === 'function') {
    return props.children;
  }

  return null;
}

export default DataProvider;
