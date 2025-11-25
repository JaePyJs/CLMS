import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, GripVertical } from 'lucide-react';

interface DraggableStudentProps {
  id: string;
  student: {
    id: string;
    studentId: string;
    studentName: string;
    gradeLevel: string;
  };
}

export function DraggableStudent({ id, student }: DraggableStudentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: id,
      data: student,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card className="mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4 border-l-primary">
        <CardContent className="p-3 flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 overflow-hidden">
            <div className="font-medium text-sm truncate">
              {student.studentName}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {student.gradeLevel}
              </Badge>
              <span className="truncate">{student.studentId}</span>
            </div>
          </div>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
