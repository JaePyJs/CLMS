import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AttendanceEventProps {
  type: 'checkin' | 'checkout';
  studentName: string;
  duration?: number;
  onComplete?: () => void;
  className?: string;
}

export const AttendanceEvent: React.FC<AttendanceEventProps> = ({
  type,
  studentName,
  duration = 5000,
  onComplete,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 300);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, onComplete]);

  const isCheckIn = type === 'checkin';
  const message = isCheckIn ? 'Welcome' : 'Goodbye';
  const bgColor = isCheckIn ? 'bg-green-500' : 'bg-blue-500';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div
            className={cn(
              'fixed inset-0 z-50 flex items-center justify-center',
              bgColor,
              className
            )}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="text-center text-white space-y-4 px-8">
              <h1 className="text-6xl md:text-8xl font-bold">{message}</h1>
              <p className="text-4xl md:text-6xl">{studentName}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

AttendanceEvent.displayName = 'AttendanceEvent';
