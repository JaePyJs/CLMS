import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormErrorProps {
  error?: string | string[];
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ error, className }) => {
  if (!error) {
    return null;
  }

  const errors = Array.isArray(error) ? error : [error];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800',
        className
      )}
    >
      <AlertCircle
        className="h-4 w-4 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1">
        {errors.length === 1 ? (
          <p>{errors[0]}</p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {errors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

FormError.displayName = 'FormError';
