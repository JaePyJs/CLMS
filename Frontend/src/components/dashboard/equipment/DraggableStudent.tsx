import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, GripVertical, MapPin, Clock } from 'lucide-react';

interface DraggableStudentProps {
  id: string;
  student: {
    id: string;
    studentId: string;
    studentName: string;
    gradeLevel: string | number;
  };
  isAssigned?: boolean;
  equipmentName?: string;
  remainingMinutes?: number;
}

export function DraggableStudent({
  id,
  student,
  isAssigned = false,
  equipmentName,
  remainingMinutes,
}: DraggableStudentProps) {
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
      <Card
        className={`mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4 ${
          isAssigned
            ? 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-l-primary'
        }`}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 overflow-hidden">
            <div className="font-medium text-sm truncate">
              {student.studentName}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {student.gradeLevel || 'N/A'}
              </Badge>
              <span className="truncate">{student.studentId}</span>
            </div>
            {isAssigned && equipmentName && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{equipmentName}</span>
                {remainingMinutes !== undefined && (
                  <>
                    <span className="mx-1">•</span>
                    <Clock className="h-3 w-3" />
                    <span>{remainingMinutes}m left</span>
                  </>
                )}
              </div>
            )}
          </div>
          <User
            className={`h-4 w-4 ${isAssigned ? 'text-blue-500' : 'text-muted-foreground'}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
