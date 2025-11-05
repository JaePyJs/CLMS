import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  QrCode,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  Eye,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { utilitiesApi } from '@/lib/api';

interface QRGenerationResult {
  studentId: string;
  name: string;
  qrPath: string;
  qrUrl: string;
  success: boolean;
  error?: string;
}

interface QRGenerationSummary {
  totalStudents: number;
  successCount: number;
  errorCount: number;
  outputDir: string;
  results: QRGenerationResult[];
  generatedAt: string;
}

export function QRCodeManager() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<QRGenerationSummary | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleGenerateAll = async () => {
    try {
      setIsGenerating(true);
      toast.info('Starting QR code generation...', {
        duration: 3000,
      });

      const response = await utilitiesApi.generateQRCodes();

      if (response.success && response.data) {
        const summary = response.data as QRGenerationSummary;
        setReport(summary);
        setShowResults(true);
        toast.success(
          `✅ Generated ${summary.successCount} QR codes successfully!`,
          { duration: 5000 }
        );
      } else {
        throw new Error(
          typeof (response as any).error === 'string'
            ? (response as any).error
            : (response as any).error?.message || 'Generation failed'
        );
      }
    } catch (error) {
      console.error('QR generation error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate QR codes'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadReport = async () => {
    try {
      const response = await utilitiesApi.getQRReport();

      if (response.success && response.data) {
        setReport(response.data as QRGenerationSummary);
        setShowResults(true);
        toast.success('Report loaded');
      } else {
        toast.error('No generation report found. Generate QR codes first.');
      }
    } catch (error) {
      toast.error('Failed to load report');
    }
  };

  const handleOpenPrintableSheet = () => {
    // Open in new window
    window.open('/api/utilities/qr-codes-sheet', '_blank');
    toast.success('Opening printable QR codes sheet...');
  };

  const handleDownloadQRCode = (studentId: string) => {
    const url = `/api/utilities/qr-code/${studentId}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentId}.png`;
    link.click();
    toast.success(`Downloading QR code for ${studentId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-black dark:text-foreground">
          QR Code Manager
        </h2>
        <p className="text-black dark:text-muted-foreground">
          Generate and manage QR codes for student check-ins
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Generate QR Codes Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Generate QR Codes
            </CardTitle>
            <CardDescription>
              Create QR codes for all active students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This will generate a unique QR code for each active student in the
              database. The QR codes can be scanned using your USB scanner or
              smartphone camera.
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateAll}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Generate All
                  </>
                )}
              </Button>

              <Button onClick={handleLoadReport} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Load Report
              </Button>
            </div>

            {isGenerating && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Generating QR codes... This may take a few moments.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* View & Print Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              View & Print
            </CardTitle>
            <CardDescription>Access printable QR code sheets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              View all generated QR codes in a printable format. Perfect for
              creating student ID cards or stickers.
            </div>

            <Button
              onClick={handleOpenPrintableSheet}
              variant="outline"
              className="w-full"
            >
              <Eye className="h-4 w-4 mr-2" />
              Open Printable Sheet
            </Button>

            <div className="text-xs text-muted-foreground">
              💡 Tip: Print on sticker paper or card stock for durable student
              IDs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {showResults && report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generation Report
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResults(false)}
              >
                Hide
              </Button>
            </CardTitle>
            <CardDescription>
              Generated on {new Date(report.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {report.totalStudents}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Students
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {report.successCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Generated</div>
                </CardContent>
              </Card>

              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    {report.errorCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </CardContent>
              </Card>
            </div>

            {/* Results List */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Individual Results</h3>
              <ScrollArea className="h-96 border rounded-lg">
                <div className="p-4 space-y-2">
                  {report.results.map((result, index) => (
                    <div
                      key={index}
                      className={`
                        flex items-center justify-between p-3 rounded-lg
                        ${
                          result.success
                            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {result.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {result.studentId}
                          </div>
                          {result.error && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                              Error: {result.error}
                            </div>
                          )}
                        </div>
                      </div>

                      {result.success && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleDownloadQRCode(result.studentId)
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              window.open(
                                `/api/utilities/qr-code/${result.studentId}`,
                                '_blank'
                              );
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">1️⃣</span>
                Generate QR Codes
              </h4>
              <p className="text-muted-foreground">
                Click "Generate All" to create QR codes for all active students
                in your database.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">2️⃣</span>
                Print or Distribute
              </h4>
              <p className="text-muted-foreground">
                Open the printable sheet and print on sticker paper or card
                stock for student IDs.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">3️⃣</span>
                Scan at Check-in
              </h4>
              <p className="text-muted-foreground">
                Students present their QR code, you scan with USB scanner for
                instant check-in.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">4️⃣</span>
                Works Offline
              </h4>
              <p className="text-muted-foreground">
                QR codes work even without internet. Scans are queued and synced
                later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeManager;
