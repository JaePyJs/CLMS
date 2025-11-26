// @ts-nocheck
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const TabsRoot = TabsPrimitive.Root;

const TabsListImpl = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-11 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 p-1.5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm',
      className
    )}
    {...props}
  />
));
TabsListImpl.displayName = TabsPrimitive.List.displayName;

const TabsTriggerImpl = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      'text-slate-800 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100',
      'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-300 dark:data-[state=active]:border-slate-700',
      className
    )}
    {...props}
  />
));
TabsTriggerImpl.displayName = TabsPrimitive.Trigger.displayName;

const TabsContentImpl = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in',
      className
    )}
    {...props}
  />
));
TabsContentImpl.displayName = TabsPrimitive.Content.displayName;

// Cast exports to any to bypass strict type checking in consumers
// This resolves the "Property 'children' does not exist" errors caused by React type version mismatches
export const Tabs = TabsRoot as any;
export const TabsList = TabsListImpl as any;
export const TabsTrigger = TabsTriggerImpl as any;
export const TabsContent = TabsContentImpl as any;
