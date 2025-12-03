import { Suspense, lazy, useState } from 'react';
import { CardSkeleton } from '@/components/LoadingStates';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

const ScanWorkspace = lazy(() =>
  import('@/components/dashboard/ScanWorkspace').then((module) => ({
    default: module.ScanWorkspace,
  }))
);

const QuickServicePanel = lazy(
  () => import('@/components/dashboard/QuickServicePanel')
);

export default function ScanStationPage() {
  const [showQuickService, setShowQuickService] = useState(false);

  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton className="h-96" />}>
        <ScanWorkspace />
      </Suspense>

      {/* Quick Service Section - Collapsible */}
      <div className="border rounded-lg bg-card">
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50"
          onClick={() => setShowQuickService(!showQuickService)}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Quick Service Mode</span>
            <span className="text-xs text-muted-foreground ml-2">
              (Print & Go, Forgot Barcode)
            </span>
          </div>
          {showQuickService ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </Button>

        {showQuickService && (
          <div className="p-4 pt-0 border-t">
            <Suspense fallback={<CardSkeleton className="h-64" />}>
              <QuickServicePanel
                onServiceComplete={() => {
                  // Could refresh some data here if needed
                }}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
