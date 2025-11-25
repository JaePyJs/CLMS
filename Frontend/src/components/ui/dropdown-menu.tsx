'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root as any;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger as any;
const DropdownMenuGroup = DropdownMenuPrimitive.Group as any;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal as any;
const DropdownMenuSub = DropdownMenuPrimitive.Sub as any;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup as any;
const DropdownMenuItemIndicator = DropdownMenuPrimitive.ItemIndicator as any;
const DropdownMenuPrimitiveSubTrigger = DropdownMenuPrimitive.SubTrigger as any;
const DropdownMenuPrimitiveSubContent = DropdownMenuPrimitive.SubContent as any;
const DropdownMenuPrimitiveContent = DropdownMenuPrimitive.Content as any;
const DropdownMenuPrimitiveItem = DropdownMenuPrimitive.Item as any;
const DropdownMenuPrimitiveCheckboxItem =
  DropdownMenuPrimitive.CheckboxItem as any;
const DropdownMenuPrimitiveRadioItem = DropdownMenuPrimitive.RadioItem as any;
const DropdownMenuPrimitiveLabel = DropdownMenuPrimitive.Label as any;
const DropdownMenuPrimitiveSeparator = DropdownMenuPrimitive.Separator as any;

const DropdownMenuSubTrigger = React.forwardRef<any, any>(
  ({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitiveSubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitiveSubTrigger>
  )
) as any;
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitiveSubContent
      ref={ref}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  )
) as any;
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<any, any>(
  ({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPortal>
      <DropdownMenuPrimitiveContent
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  )
) as any;
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<any, any>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitiveItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  )
) as any;
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<any, any>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitiveCheckboxItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownMenuItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitiveCheckboxItem>
  )
) as any;
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<any, any>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitiveRadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuItemIndicator>
          <Circle className="h-2 w-2 fill-current" />
        </DropdownMenuItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitiveRadioItem>
  )
) as any;
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<any, any>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitiveLabel
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-sm font-semibold',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  )
) as any;
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<any, any>(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitiveSeparator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-muted', className)}
      {...props}
    />
  )
) as any;
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
