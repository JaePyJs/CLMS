import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableEquipmentProps {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function DroppableEquipment({
  id,
  disabled,
  children,
}: DroppableEquipmentProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
    disabled: disabled,
  });

  // Only reduce opacity for the drag overlay hint, not the entire card
  // The card should always be fully visible and interactive
  const style = {
    // Keep full opacity - the disabled only affects drag-drop, not visibility
    opacity: 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative h-full">
      {children}
      {isOver && !disabled && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded-lg z-10 flex items-center justify-center pointer-events-none animate-pulse">
          <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full font-semibold text-primary shadow-lg">
            Drop to Assign
          </div>
        </div>
      )}
    </div>
  );
}
