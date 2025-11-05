import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

/**
 * SkeletonLoader - Animated skeleton placeholder for loading states
 * 
 * @param variant - Shape of the skeleton (text, circular, rectangular)
 * @param width - Width of the skeleton
 * @param height - Height of the skeleton
 * @param count - Number of skeleton elements to render
 * @param className - Additional CSS classes
 * 
 * @example
 * <SkeletonLoader variant="text" count={3} />
 * <SkeletonLoader variant="circular" width={40} height={40} />
 * <SkeletonLoader variant="rectangular" width="100%" height={200} />
 */
export function SkeletonLoader({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1,
}: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';

  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-lg';
      default:
        return '';
    }
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  const elements = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={style}
      aria-hidden="true"
    />
  ));

  return count > 1 ? (
    <div className="flex flex-col gap-2">{elements}</div>
  ) : (
    <>{elements}</>
  );
}

/**
 * CardSkeleton - Skeleton for card components
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
      <SkeletonLoader variant="text" width="60%" className="mb-4" />
      <SkeletonLoader variant="text" count={3} className="mb-2" />
      <SkeletonLoader variant="rectangular" height={200} className="mt-4" />
    </div>
  );
}

/**
 * TableSkeleton - Skeleton for table rows
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4">
          <SkeletonLoader variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <SkeletonLoader variant="text" width="80%" />
            <SkeletonLoader variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * AvatarSkeleton - Skeleton for user avatars
 */
export function AvatarSkeleton({ size = 40 }: { size?: number }) {
  return <SkeletonLoader variant="circular" width={size} height={size} />;
}

/**
 * TextBlockSkeleton - Skeleton for text content blocks
 */
export function TextBlockSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonLoader variant="text" count={lines} />
    </div>
  );
}

export default SkeletonLoader;
