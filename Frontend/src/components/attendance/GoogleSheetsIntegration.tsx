import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAttendanceSync } from '@/hooks/useAttendanceSync';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

// Service account email for Google Sheets integration
const SERVICE_EMAIL =
  'google-sheer-drive-integration@clms-474510.iam.gserviceaccount.com';

interface SheetRow {
  studentId?: string;
  surname?: string;
  firstName?: string;
  timestamp?: string;
  bookTitle?: string;
  title?: string;
  action?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  errors: { row?: number; error: string }[];
  preview?: SheetRow[];
  rowCount?: number;
}

// Helper to get activity type badge
const getActivityTypeBadge = (row: SheetRow) => {
  // Determine type based on available data
  const hasBook = row.bookTitle || row.title;
  const action = String(row.action || '').toLowerCase();

  if (hasBook) {
    return {
      type: 'Borrowed',
      className:
        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };
  }

  if (action.includes('print')) {
    return {
      type: 'Print',
      className:
        'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    };
  }

  if (action.includes('out') || action.includes('checkout')) {
    return {
      type: 'Check Out',
      className:
        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    };
  }

  return {
    type: 'Check In',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };
};

export const GoogleSheetsIntegration: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Attendance Hooks
  const {
    importFromHelpers: importAttendance,
    exportToHelpers: exportAttendance,
    validateSheet: validateAttendance,
  } = useAttendanceSync();

  // Shared State
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Student Activities');

  // Import State
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [previewData, setPreviewData] = useState<SheetRow[]>([]);

  // Export State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  const isImporting = importAttendance.isPending;
  const isExporting = exportAttendance.isPending;

  const copyToClipboard = async (text: string, type: 'email' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setPreviewData([]);
    try {
      const result = (await validateAttendance(
        spreadsheetId,
        sheetName
      )) as ValidationResult;

      setValidationResult(result);
      if (result.valid && result.preview) {
        setPreviewData(result.preview);
      }
    } catch (error: unknown) {
      setValidationResult({
        valid: false,
        errors: [{ error: (error as Error).message }],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = () => {
    console.info('Starting import with:', { spreadsheetId, sheetName });
    importAttendance.mutate(
      { spreadsheetId, sheetName },
      {
        onSuccess: (response) => {
          console.info('Import successful:', response);
          const data = (response as { data?: unknown })?.data || response;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedData = data as any;
          const imported = typedData?.imported || 0;
          const parsed = typedData?.sheetParsed || 0;
          const notFound = typedData?.skippedStudentNotFound || 0;
          const duplicates = typedData?.skippedDuplicate || 0;
          const unmatchedIds = typedData?.unmatchedStudentIds || [];

          if (imported === 0 && notFound > 0) {
            toast.warning('No records imported', {
              description: `${notFound} students not found. Sample IDs: ${unmatchedIds.slice(0, 5).join(', ')}`,
              duration: 10000,
            });
          } else if (imported > 0) {
            let desc = `${imported} saved.`;
            if (notFound > 0) desc += ` ${notFound} skipped (not found).`;
            if (duplicates > 0) desc += ` ${duplicates} duplicates.`;
            toast.success(`Imported ${imported} of ${parsed} records`, {
              description: desc,
              duration: 8000,
            });
          } else {
            toast.info('No new records to import');
          }

          setIsOpen(false);
          setValidationResult(null);
          setPreviewData([]);
        },
        onError: (error) => {
          console.error('Import failed:', error);
          toast.error('Import failed', {
            description:
              error instanceof Error ? error.message : 'Unknown error occurred',
          });
        },
      }
    );
  };

  const handleExport = () => {
    const payload = { spreadsheetId, sheetName, startDate, endDate, overwrite };
    exportAttendance.mutate(payload, { onSuccess: () => setIsOpen(false) });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Google Sheets Sync
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance - Google Sheets</DialogTitle>
          <DialogDescription>
            Import or export all student activity records (Check In, Borrowing,
            Printing) with Google Sheets.
          </DialogDescription>
        </DialogHeader>

        {/* Setup Instructions */}
        <div className="border rounded-lg">
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Setup Instructions</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {showInstructions ? '▲ Hide' : '▼ Show'}
            </span>
          </Button>
          {showInstructions && (
            <Alert className="m-2 mt-0">
              <Info className="h-4 w-4" />
              <AlertTitle>Before you start</AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-sm">
                  To connect CLMS with your Google Sheet, you need to share your
                  spreadsheet with our service account:
                </p>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    1. Service Account Email (Click to copy)
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono break-all">
                      {SERVICE_EMAIL}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(SERVICE_EMAIL, 'email')}
                      className="shrink-0"
                    >
                      {copiedEmail ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    2. How to share your Google Sheet:
                  </Label>
                  <ol className="text-xs list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Open your Google Sheet</li>
                    <li>Click the "Share" button (top right)</li>
                    <li>Paste the service email above</li>
                    <li>Set permission to "Editor"</li>
                    <li>
                      Click "Send" (ignore the warning about external email)
                    </li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    3. Get your Spreadsheet ID:
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    The ID is in your Google Sheet URL between <code>/d/</code>{' '}
                    and <code>/edit</code>
                  </p>
                  <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                    https://docs.google.com/spreadsheets/d/
                    <span className="text-blue-500 font-bold">
                      YOUR_SPREADSHEET_ID
                    </span>
                    /edit
                  </code>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    4. Required Columns in your sheet:
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Your sheet should have these headers: <code>Timestamp</code>
                    , <code>User ID</code>, <code>Surname</code>,{' '}
                    <code>First Name</code>, <code>Grade Level</code>,{' '}
                    <code>Section</code>, <code>Designation</code>,{' '}
                    <code>Sex</code>, <code>Action</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    For borrowing records, also include: <code>Title</code>,{' '}
                    <code>Author</code>, <code>Status</code>,{' '}
                    <code>Due Date</code>
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
          </TabsList>

          {/* IMPORT TAB */}
          <TabsContent value="import" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="spreadsheetId"
                    placeholder="e.g. 1BxiMvs0XRA5nFK..."
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                  />
                  {spreadsheetId && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(spreadsheetId, 'id')}
                      title="Copy ID"
                    >
                      {copiedId ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheetName">Sheet Name (Tab)</Label>
                <Input
                  id="sheetName"
                  placeholder="Student Activities"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleValidate}
              disabled={!spreadsheetId || !sheetName || isValidating}
              className="w-full"
              variant="secondary"
            >
              {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Validate & Preview
            </Button>

            {validationResult && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-semibold">
                    {validationResult.valid
                      ? `Validation Passed - ${validationResult.rowCount || previewData.length} records found`
                      : 'Validation Failed'}
                  </span>
                </div>

                {!validationResult.valid && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Errors Found</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 text-sm max-h-32 overflow-y-auto">
                        {validationResult.errors.map((e, i) => (
                          <li key={i}>
                            Row {e.row}: {e.error}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validationResult.valid && previewData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview (First 10 Rows)</Label>
                    <div className="border rounded-md max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 10).map((row, i) => {
                            const badge = getActivityTypeBadge(row);
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">
                                  {row.studentId}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.surname}, {row.firstName}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.timestamp
                                    ? new Date(row.timestamp).toLocaleString()
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span
                                    className={`px-2 py-0.5 rounded ${badge.className}`}
                                  >
                                    {badge.type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {row.bookTitle ||
                                    row.title ||
                                    row.action ||
                                    '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={handleImport}
                disabled={!validationResult?.valid || isImporting}
              >
                {isImporting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import{' '}
                {validationResult?.rowCount
                  ? `${validationResult.rowCount} Records`
                  : ''}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="spreadsheetIdExp">Spreadsheet ID</Label>
                <Input
                  id="spreadsheetIdExp"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheetNameExp">Sheet Name</Label>
                <Input
                  id="sheetNameExp"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="overwrite"
                checked={overwrite}
                onCheckedChange={(c) => setOverwrite(!!c)}
              />
              <Label htmlFor="overwrite">
                Overwrite existing sheet content
              </Label>
            </div>

            <DialogFooter>
              <Button
                onClick={handleExport}
                disabled={!startDate || !endDate || isExporting}
              >
                {isExporting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Export to Sheets
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
