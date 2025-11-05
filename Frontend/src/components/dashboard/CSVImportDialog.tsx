import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  RefreshCw,
  FileUp,
  Table,
} from 'lucide-react';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  templateColumns: string[];
  onImport: (data: Record<string, unknown>[]) => Promise<void>;
  entityName?: string;
}

interface ImportPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function CSVImportDialog({
  open,
  onOpenChange,
  title = 'Import CSV Data',
  description = 'Upload a CSV file to import multiple records',
  templateColumns,
  onImport,
  entityName = 'records',
}: CSVImportDialogProps) {
  const { isMobile } = useMobileOptimization();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<{
    valid: number;
    invalid: number;
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = async (file: File) => {
    setIsProcessing(true);
    setErrors([]);
    setProgress(10);

    try {
      const text = await file.text();
      setProgress(30);

      // Parse CSV
      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Extract headers - we know lines[0] exists because we checked length > 0
      const firstLine = lines[0];
      if (!firstLine) {
        throw new Error('CSV file has no valid header row');
      }
      const headers = firstLine
        .split(',')
        .map((h) => h.trim().replace(/^"|"$/g, ''));
      setProgress(50);

      // Validate headers
      const missingColumns = templateColumns.filter(
        (col) => !headers.includes(col)
      );
      if (missingColumns.length > 0) {
        setErrors([
          `Missing required columns: ${missingColumns.join(', ')}`,
          `Expected columns: ${templateColumns.join(', ')}`,
        ]);
        setProgress(0);
        setIsProcessing(false);
        return;
      }

      // Parse rows
      const rows = lines.slice(1, Math.min(6, lines.length)).map((line) => {
        const values = line
          .split(',')
          .map((v) => v.trim().replace(/^"|"$/g, ''));
        return values;
      });

      setProgress(70);

      // Validate data
      const validation = validateData(headers, rows);
      setValidationResult(validation);

      setPreview({
        headers,
        rows,
        totalRows: lines.length - 1,
      });

      setProgress(100);
      toast.success(`Parsed ${lines.length - 1} ${entityName} successfully`);
    } catch (error) {
      console.error('CSV parsing error:', error);
      setErrors([
        error instanceof Error ? error.message : 'Failed to parse CSV file',
      ]);
      toast.error('Failed to parse CSV file');
    } finally {
      setIsProcessing(false);
    }
  };

  const validateData = (
    headers: string[],
    rows: string[][]
  ): {
    valid: number;
    invalid: number;
    warnings: string[];
  } => {
    let valid = 0;
    let invalid = 0;
    const warnings: string[] = [];

    rows.forEach((row, index) => {
      // Check for empty required fields
      const hasEmptyRequired = row.some((cell, cellIndex) => {
        const header = headers[cellIndex];
        return header && templateColumns.includes(header) && !cell?.trim();
      });

      if (hasEmptyRequired) {
        invalid++;
        warnings.push(`Row ${index + 2}: Missing required fields`);
      } else {
        valid++;
      }

      // Check for data length issues
      if (row.length !== headers.length) {
        warnings.push(`Row ${index + 2}: Column count mismatch`);
      }
    });

    return { valid, invalid, warnings: warnings.slice(0, 5) };
  };

  const handleImport = async () => {
    if (!file) {
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length === 0) {
        setPreview(null);
        return;
      }
      const firstLine = lines[0];
      if (!firstLine) {
        setPreview(null);
        return;
      }
      const headers = firstLine
        .split(',')
        .map((h) => h.trim().replace(/^"|"$/g, ''));

      // Parse all rows into objects
      const data = lines.slice(1).map((line) => {
        const values = line
          .split(',')
          .map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      // Batch import with progress
      const batchSize = 50;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        await onImport(batch);
        setProgress(Math.round(((i + batch.length) / data.length) * 100));
      }

      toast.success(`Successfully imported ${data.length} ${entityName}`);
      handleClose();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const downloadTemplate = () => {
    const csv = templateColumns.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName}-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setErrors([]);
    setValidationResult(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={
          isMobile
            ? 'w-full max-w-full h-full'
            : 'max-w-3xl max-h-[90vh] overflow-y-auto'
        }
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">Download Template</p>
                    <p className="text-sm text-muted-foreground">
                      Get the CSV template with required columns
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          {!file && (
            <Card
              className="border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="p-8">
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium mb-2">Click to upload CSV file</p>
                  <p className="text-sm text-muted-foreground">
                    Or drag and drop your file here
                  </p>
                  <Badge variant="outline" className="mt-4">
                    Max size: 10MB
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Processing */}
          {isProcessing && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="font-medium">Processing CSV file...</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {progress}% complete
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview && validationResult && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileUp className="h-5 w-5 text-green-500" />
                        <span className="font-medium">{file?.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                          setValidationResult(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {preview.totalRows}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total Rows
                        </div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {validationResult.valid}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Valid
                        </div>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {validationResult.invalid}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Invalid
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Validation Warnings:</p>
                      {validationResult.warnings.map((warning, index) => (
                        <div key={index} className="text-sm">
                          • {warning}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      <span className="font-medium">
                        Preview (First 5 rows)
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {preview.headers.map((header, index) => (
                              <th
                                key={index}
                                className="text-left p-2 font-medium"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-b">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="p-2">
                                  {cell || (
                                    <span className="text-muted-foreground italic">
                                      empty
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !preview ||
              isProcessing ||
              validationResult?.invalid === preview?.totalRows
            }
            className="w-full sm:w-auto"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Import {preview?.totalRows || 0} {entityName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
