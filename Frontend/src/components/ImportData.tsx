import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Zap, Database, FileText } from 'lucide-react';
import EnhancedImportManager from './Import/EnhancedImportManager';
import { toast } from 'sonner';

export default function ImportData() {
  const [useEnhancedImporter, setUseEnhancedImporter] = useState(true);

  const toggleImporter = () => {
    setUseEnhancedImporter(!useEnhancedImporter);
    toast.info(
      useEnhancedImporter
        ? 'Switched to Enhanced Importer'
        : 'Switched to Legacy Importer'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Import Data</h2>
          <p className="text-muted-foreground">
            {useEnhancedImporter
              ? 'Enhanced CSV/Excel import with intelligent field mapping'
              : 'Basic CSV file import functionality'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={toggleImporter}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          {useEnhancedImporter ? 'Use Legacy' : 'Use Enhanced'}
        </Button>
      </div>

      {useEnhancedImporter ? (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertTitle>Enhanced Import Mode Active</AlertTitle>
          <AlertDescription>
            Excel support, auto field detection, intelligent data mapping, and
            real-time preview functionality.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Legacy Import Mode</AlertTitle>
          <AlertDescription>
            Basic CSV import functionality for quick data migration.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {useEnhancedImporter ? (
              <FileText className="h-5 w-5" />
            ) : (
              <Database className="h-5 w-5" />
            )}
            {useEnhancedImporter
              ? 'Enhanced Import Manager'
              : 'Basic Import Manager'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {useEnhancedImporter ? (
            <EnhancedImportManager />
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Basic CSV import functionality is available. Switch to Enhanced
                mode for Excel support and advanced features.
              </p>
              <Button onClick={toggleImporter} className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Enable Enhanced Import
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
