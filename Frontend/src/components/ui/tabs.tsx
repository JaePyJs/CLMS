import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Tabs value type
 *
 * By default, Radix Tabs expects `string` values. To enable stricter typing
 * across your app, each wrapper below supports a generic `TValue extends string`.
 * You can keep using it as-is (defaults to `string`) or provide a string union
 * for compile-time safety:
 *
 * Example:
 *   type TabId = "overview" | "reports" | "settings"
 *   <Tabs<TabId> defaultValue="overview">
 *     <TabsList>
 *       <TabsTrigger<TabId> value="overview" />
 *       <TabsTrigger<TabId> value="reports" />
 *       <TabsTrigger<TabId> value="settings" />
 *     </TabsList>
 *     <TabsContent<TabId> value="overview" />
 *     <TabsContent<TabId> value="reports" />
 *     <TabsContent<TabId> value="settings" />
 *   </Tabs>
 *
 * This preserves the existing shadcn-style API while allowing stricter typing.
 */
export type TabsValue = string

/**
 * Props for the typed Tabs Root component.
 *
 * - Narrow `value`/`defaultValue` to a string union via `TValue extends string`.
 * - Keep compatibility with Radix by forwarding all other props.
 * - `onValueChange` is aligned to the same `TValue` type.
 */
export type TabsProps<TValue extends TabsValue = TabsValue> = Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
  "value" | "defaultValue" | "onValueChange"
> & {
  /**
   * Controlled selected tab value. Provide a union for strict typing.
   */
  value?: TValue
  /**
   * Uncontrolled initial tab value. Provide a union for strict typing.
   */
  defaultValue?: TValue
  /**
   * Change handler aligned to your union-typed tab values.
   */
  onValueChange?: (value: TValue) => void
}

/**
 * Tabs Root wrapper with generics.
 *
 * We cast the `forwardRef` to a callable type to expose the generic `TValue` to
 * consumers without changing the runtime behavior.
 */
const Tabs = (React.forwardRef(function TabsInternal<
  TValue extends TabsValue = TabsValue
>(
  { className, ...props }: TabsProps<TValue>,
  ref: React.Ref<React.ElementRef<typeof TabsPrimitive.Root>>
) {
  const cls = className ?? undefined
  return <TabsPrimitive.Root ref={ref} className={cls} {...(props as any)} />
}) as any) as <TValue extends TabsValue = TabsValue>(
  props: TabsProps<TValue> & {
    ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Root>>
  }
) => React.ReactElement

/**
 * TabsList keeps existing API. No `value` props here, so no extra typing.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 p-1.5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

/**
 * Props for a typed TabsTrigger. The `value` prop is narrowed using generics.
 */
export type TabsTriggerProps<TValue extends TabsValue = TabsValue> = Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
  "value"
> & {
  /**
   * The tab value this trigger represents. Use a union for stronger typing.
   */
  value: TValue
}

/**
 * Trigger wrapper
 *
 * Aligns with Radix's `string` value prop while enabling union typing through
 * `TValue extends string`. Usage without generics remains fully compatible.
 */
const TabsTrigger = (React.forwardRef(function TabsTriggerInternal<
  TValue extends TabsValue = TabsValue
>(
  { className, ...props }: TabsTriggerProps<TValue>,
  ref: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>>
) {
  const cls = className ?? undefined
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-300 dark:data-[state=active]:border-slate-700",
        cls
      )}
      {...props as any}
    />
  )
}) as any) as <TValue extends TabsValue = TabsValue>(
  props: TabsTriggerProps<TValue> & {
    ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>>
  }
) => React.ReactElement

/**
 * Props for a typed TabsContent. The `value` prop is narrowed using generics.
 */
export type TabsContentProps<TValue extends TabsValue = TabsValue> = Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>,
  "value"
> & {
  /**
   * The tab value this content is associated with.
   */
  value: TValue
}

/**
 * Content wrapper
 *
 * Enables union typing for the `value` prop while preserving the shadcn-style
 * API and runtime behavior.
 */
const TabsContent = (React.forwardRef(function TabsContentInternal<
  TValue extends TabsValue = TabsValue
>(
  { className, ...props }: TabsContentProps<TValue>,
  ref: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>>
) {
  const cls = className ?? undefined
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in",
        cls
      )}
      {...props as any}
    />
  )
}) as any) as <TValue extends TabsValue = TabsValue>(
  props: TabsContentProps<TValue> & {
    ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>>
  }
) => React.ReactElement

export { Tabs, TabsList, TabsTrigger, TabsContent }