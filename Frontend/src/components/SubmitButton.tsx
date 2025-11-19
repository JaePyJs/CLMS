import React from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  loadingText?: string;
  successText?: string;
  errorText?: string;
}

export const SubmitButton = React.forwardRef<
  HTMLButtonElement,
  SubmitButtonProps
>(
  (
    {
      isLoading = false,
      isSuccess = false,
      isError = false,
      loadingText = 'Submitting...',
      successText,
      errorText,
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const getButtonContent = () => {
      if (isLoading) {
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText}
          </>
        );
      }

      if (isSuccess && successText) {
        return (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            {successText}
          </>
        );
      }

      if (isError && errorText) {
        return (
          <>
            <AlertCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            {errorText}
          </>
        );
      }

      return children;
    };

    return (
      <Button
        ref={ref}
        type="submit"
        disabled={disabled || isLoading || isSuccess}
        aria-busy={isLoading}
        aria-live="polite"
        className={cn(
          isSuccess && 'bg-green-600 hover:bg-green-700',
          isError && 'bg-red-600 hover:bg-red-700',
          className
        )}
        {...props}
      >
        {getButtonContent()}
      </Button>
    );
  }
);

SubmitButton.displayName = 'SubmitButton';
