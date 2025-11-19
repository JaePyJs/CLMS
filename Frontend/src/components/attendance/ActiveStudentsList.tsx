import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Grid, List, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ActiveStudent {
  id: string;
  name: string;
  checkedInAt: Date;
  autoLogoutAt: Date;
}

export interface ActiveStudentsListProps {
  students: ActiveStudent[];
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  className?: string;
}

export const ActiveStudentsList: React.FC<ActiveStudentsListProps> = ({
  students,
  viewMode: controlledViewMode,
  onViewModeChange,
  className,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'list'>(
    'list'
  );
  const viewMode = controlledViewMode || internalViewMode;

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  const getTimeRemaining = (autoLogoutAt: Date) => {
    const now = new Date();
    const diff = autoLogoutAt.getTime() - now.getTime();
    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (minutes < 0) {
      return 'Logging out...';
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  };

  const StudentCard: React.FC<{ student: ActiveStudent }> = ({ student }) => (
    <div className="border rounded-lg p-4 bg-card hover:bg-accent transition-colors">
      <h3 className="font-semibold text-lg mb-2">{student.name}</h3>
      <div className="text-sm text-muted-foreground space-y-1">
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Checked in{' '}
          {formatDistanceToNow(student.checkedInAt, { addSuffix: true })}
        </p>
        <p className="font-medium text-orange-500">
          {getTimeRemaining(student.autoLogoutAt)}
        </p>
      </div>
    </div>
  );

  const StudentRow: React.FC<{ student: ActiveStudent }> = ({ student }) => (
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 hover:bg-accent transition-colors">
      <div>
        <h3 className="font-semibold">{student.name}</h3>
        <p className="text-sm text-muted-foreground">
          Checked in{' '}
          {formatDistanceToNow(student.checkedInAt, { addSuffix: true })}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-orange-500">
          {getTimeRemaining(student.autoLogoutAt)}
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Currently Checked In ({students.length})
        </h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              handleViewModeChange('list');
            }}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              handleViewModeChange('grid');
            }}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No students currently checked in</p>
        </div>
      ) : (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'border rounded-lg bg-card'
          )}
        >
          {students.map((student) =>
            viewMode === 'grid' ? (
              <StudentCard key={student.id} student={student} />
            ) : (
              <StudentRow key={student.id} student={student} />
            )
          )}
        </div>
      )}
    </div>
  );
};

ActiveStudentsList.displayName = 'ActiveStudentsList';
