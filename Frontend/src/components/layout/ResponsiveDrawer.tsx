import React from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface ResponsiveDrawerProps {
  open: boolean
  onOpenChange: (value: boolean) => void
  title?: string
  description?: string
  side?: 'left' | 'right'
  children: React.ReactNode
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'left',
}: ResponsiveDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-[85vw] sm:w-[400px] overflow-y-auto">
        {(title || description) && (
          <SheetHeader className="space-y-1 pb-4">
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div className="space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
