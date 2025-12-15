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
import { useBorrowingSync } from '@/hooks/useBorrowingSync';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
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

interface BorrowingRecord {
  studentId: string;
  surname: string;
  firstName: string;
  bookTitle: string;
  borrowDate: string | Date;
  returnedDate?: string | Date;
  status: string;
}

interface ValidationResult {
  valid: boolean;
  rowCount?: number;
  errors?: Array<{ row?: number; error: string }>;
  preview?: BorrowingRecord[];
}

export const BorrowingGoogleSheetsIntegration: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Borrowing Hooks
  const { importBorrowing, exportBorrowing, validateBorrowingSheet } =
    useBorrowingSync();

  // Shared State
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Borrowing History');

  // Import State
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [previewData, setPreviewData] = useState<BorrowingRecord[]>([]);

  // Export State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  const isImporting = importBorrowing.isPending;
  const isExporting = exportBorrowing.isPending;

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);
    setPreviewData([]);
    try {
      const result = await validateBorrowingSheet(spreadsheetId, sheetName);

      setValidationResult(result as ValidationResult);
      if (result.valid && result.preview) {
        setPreviewData(result.preview as BorrowingRecord[]);
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [{ error: (error as Error).message }],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = () => {
    importBorrowing.mutate(
      { spreadsheetId, sheetName },
      { onSuccess: () => setIsOpen(false) }
    );
  };

  const handleExport = () => {
    const payload = { spreadsheetId, sheetName, startDate, endDate, overwrite };
    exportBorrowing.mutate(payload, { onSuccess: () => setIsOpen(false) });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Google Sheets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Borrowing History - Google Sheets</DialogTitle>
          <DialogDescription>
            Import or export book borrowing/return records with Google Sheets.
          </DialogDescription>
        </DialogHeader>

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
                <Input
                  id="spreadsheetId"
                  placeholder="e.g. 1BxiMvs0XRA5nFK..."
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in your Google Sheet URL after /d/
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheetName">Sheet Name (Tab)</Label>
                <Input
                  id="sheetName"
                  placeholder="Borrowing History"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Name of the tab containing borrowing data
                </p>
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

                {!validationResult.valid && validationResult.errors && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Errors Found</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 text-sm max-h-32 overflow-y-auto">
                        {validationResult.errors.map((e, i) => (
                          <li key={i}>
                            {e.row ? `Row ${e.row}: ` : ''}
                            {e.error}
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
                            <TableHead>Book Title</TableHead>
                            <TableHead>Borrowed</TableHead>
                            <TableHead>Returned</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">
                                {row.studentId}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.surname}, {row.firstName}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {row.bookTitle}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.borrowDate
                                  ? new Date(
                                      row.borrowDate
                                    ).toLocaleDateString()
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.returnedDate
                                  ? new Date(
                                      row.returnedDate
                                    ).toLocaleDateString()
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    row.status === 'Returned'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                      : row.status === 'Overdue'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
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
                <Label htmlFor="sheetNameExp">Sheet Name (Tab)</Label>
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
