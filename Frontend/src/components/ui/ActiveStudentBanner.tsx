import { useEffect, useState } from 'react';
import { Users, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Student {
  id: string;
  name: string;
  gradeLevel: string;
  gradeCategory: string;
  barcode?: string;
}

interface ActiveStudentBannerProps {
  student: Student;
  onClear: () => void;
}

export function ActiveStudentBanner({
  student,
  onClear,
}: ActiveStudentBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(900); // 15 mins in seconds

  useEffect(() => {
    // Update countdown every second
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [student]);

  // Reset timer when student changes
  useEffect(() => {
    setTimeRemaining(900);
  }, [student.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining > 300) return 'text-blue-100'; // > 5 mins
    if (timeRemaining > 60) return 'text-yellow-200'; // 1-5 mins
    return 'text-red-200 animate-pulse'; // < 1 min
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 flex items-center justify-between border-b border-blue-700 shadow-lg z-40 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4">
        <div className="bg-white/20 p-2 rounded-full">
          <Users className="h-5 w-5" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{student.name}</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {student.gradeLevel}
            </span>
          </div>
          <span className="text-sm text-blue-100">
            ID: {student.barcode || student.id}
          </span>
        </div>

        <div className={`flex items-center gap-1.5 ml-4 ${getTimerColor()}`}>
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="text-white hover:bg-white/20 h-9 px-3 transition-colors"
        title="Clear Active Student (Ctrl+Shift+C)"
      >
        <X className="h-4 w-4 mr-1.5" />
        Clear
      </Button>
    </div>
  );
}
