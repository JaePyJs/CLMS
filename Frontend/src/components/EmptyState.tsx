import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState - Component for displaying empty states with optional action
 * 
 * @param icon - Lucide icon component to display
 * @param title - Main title text
 * @param description - Optional description text
 * @param action - Optional action button config
 * @param className - Additional CSS classes
 * 
 * @example
 * <EmptyState
 *   icon={FileText}
 *   title="No documents found"
 *   description="Get started by creating your first document"
 *   action={{
 *     label: "Create Document",
 *     onClick: () => handleCreate()
 *   }}
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
          <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        </div>
      )}

      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>

      {description && (
        <p className="mb-6 max-w-md text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * SearchEmptyState - Pre-configured empty state for search results
 */
export function SearchEmptyState({ searchTerm }: { searchTerm?: string }) {
  return (
    <EmptyState
      title="No results found"
      description={
        searchTerm
          ? `No results found for "${searchTerm}". Try a different search term.`
          : 'Try adjusting your search filters to find what you\'re looking for.'
      }
    />
  );
}

/**
 * ErrorEmptyState - Pre-configured empty state for errors
 */
export function ErrorEmptyState({
  message = 'Something went wrong',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Error"
      description={message}
      action={
        onRetry
          ? {
              label: 'Try Again',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

export default EmptyState;
