import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ScanLine,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  Eye,
  FileText,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { utilitiesApi } from '@/lib/api';

interface BarcodeGenerationResult {
  studentId: string;
  name: string;
  barcodePath: string;
  barcodeUrl: string;
  success: boolean;
  error?: string;
}

interface BarcodeGenerationSummary {
  totalStudents: number;
  successCount: number;
  errorCount: number;
  outputDir: string;
  results: BarcodeGenerationResult[];
  generatedAt: string;
}

function BarcodeManager() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<BarcodeGenerationSummary | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleGenerateAll = async () => {
    try {
      setIsGenerating(true);
      toast.info('Starting barcode generation...', {
        duration: 3000,
      });

      const response = await utilitiesApi.generateBarcodes();

      if (response.data) {
        const summary = response.data as BarcodeGenerationSummary;
        setReport(summary);
        setShowResults(true);
        toast.success(
          `✅ Generated ${summary.successCount} barcodes successfully!`,
          { duration: 5000 }
        );
      } else {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : ((response.error as Record<string, unknown> | undefined)
                ?.message as string) || 'Generation failed'
        );
      }
    } catch (error) {
      console.error('Barcode generation error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate barcodes'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadReport = async () => {
    try {
      const response = await utilitiesApi.getBarcodeReport();

      if (response.data) {
        setReport(response.data as BarcodeGenerationSummary);
        setShowResults(true);
        toast.success('Report loaded');
      } else {
        toast.error('No generation report found. Generate barcodes first.');
      }
    } catch {
      toast.error('Failed to load report');
    }
  };

  const handleOpenPrintableSheet = () => {
    // Open in new window
    window.open('/api/utilities/barcodes-sheet', '_blank');
    toast.success('Opening printable barcodes sheet...');
  };

  const successResults = report?.results.filter((r) => r.success) || [];
  const errorResults = report?.results.filter((r) => !r.success) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Barcode Management
        </h2>
        <p className="text-muted-foreground">
          Generate and manage student barcodes for scanning and tracking
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Generate All Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              Generate Barcodes
            </CardTitle>
            <CardDescription>
              Create barcodes for all active students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateAll}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ScanLine className="mr-2 h-4 w-4" />
                  Generate All
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* View Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              View Report
            </CardTitle>
            <CardDescription>Load the latest generation report</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLoadReport}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Eye className="mr-2 h-4 w-4" />
              Load Report
            </Button>
          </CardContent>
        </Card>

        {/* Printable Sheet Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print Sheet
            </CardTitle>
            <CardDescription>Open printable barcode sheet</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleOpenPrintableSheet}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Printer className="mr-2 h-4 w-4" />
              Open Sheet
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Report Summary */}
      {report && showResults && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Summary</CardTitle>
            <CardDescription>
              Generated on {new Date(report.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  Total Students
                </span>
                <span className="text-2xl font-bold">
                  {report.totalStudents}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  ✅ Success
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {report.successCount}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">❌ Errors</span>
                <span className="text-2xl font-bold text-red-600">
                  {report.errorCount}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  Success Rate
                </span>
                <span className="text-2xl font-bold">
                  {Math.round(
                    (report.successCount / report.totalStudents) * 100
                  )}
                  %
                </span>
              </div>
            </div>

            {report.errorCount > 0 && (
              <Alert className="mt-4" variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {report.errorCount} barcode(s) failed to generate. Check the
                  results below.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results List */}
      {report && showResults && successResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Barcodes</CardTitle>
            <CardDescription>
              Click on any barcode to download it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {successResults.map((result) => (
                  <div
                    key={result.studentId}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {result.studentId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Generated</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const url = `http://localhost:3001${result.barcodeUrl}`;
                          window.open(url, '_blank');
                          toast.success('Opening barcode image...');
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Error Results */}
      {report && showResults && errorResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Failed Barcodes</CardTitle>
            <CardDescription>
              These students encountered errors during generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {errorResults.map((result) => (
                  <div
                    key={result.studentId}
                    className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {result.studentId}
                        </p>
                        <p className="text-sm text-red-600 mt-1">
                          {result.error}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await utilitiesApi.regenerateBarcode(
                            result.studentId
                          );
                          toast.success('Barcode regenerated!');
                          handleLoadReport(); // Refresh report
                        } catch {
                          toast.error('Failed to regenerate barcode');
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Code128 Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <h4 className="font-medium">High Compatibility</h4>
              <p className="text-muted-foreground">
                Code128 barcodes work with all standard USB scanners and are
                widely supported.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Maximize2 className="h-4 w-4" />
              Compressed Printing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <h4 className="font-medium">Save Paper</h4>
              <p className="text-muted-foreground">
                Use the "Toggle Compressed Mode" button on the printable sheet
                to fit 4 barcodes per row instead of 3.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print-Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <h4 className="font-medium">Optimized Layout</h4>
              <p className="text-muted-foreground">
                Printable sheet includes student names and IDs, formatted for
                easy cutting and distribution.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BarcodeManager;
