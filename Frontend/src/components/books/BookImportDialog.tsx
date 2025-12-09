import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  Fragment,
} from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { booksApi } from '@/lib/api';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  Settings,
  File as FileIcon,
  BookOpen,
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getErrorMessage } from '@/utils/errorHandling';

// Types for import functionality
interface ImportedBook {
  rowNumber: number;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  category?: string;
  subcategory?: string;
  location?: string;
  accession_no?: string;
  available_copies?: string;
  total_copies?: string;
  cost_price?: string;
  edition?: string;
  pages?: string;
  remarks?: string;
  source_of_fund?: string;
  volume?: string;
  year?: string;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  required: boolean;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  samples: ImportedBook[];
}

// Result type for import mutations
interface ImportPreviewResult {
  records?: ImportedBook[];
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateRecords?: number;
}

// Available fields for mapping
const AVAILABLE_FIELDS: FieldMapping[] = [
  { sourceField: 'title', targetField: 'title', required: true },
  { sourceField: 'author', targetField: 'author', required: true },
  { sourceField: 'accessionNo', targetField: 'accession_no', required: false },
  { sourceField: 'isbn', targetField: 'isbn', required: false },
  { sourceField: 'publisher', targetField: 'publisher', required: false },
  { sourceField: 'category', targetField: 'category', required: false },
  { sourceField: 'subcategory', targetField: 'subcategory', required: false },
  { sourceField: 'location', targetField: 'location', required: false },
  {
    sourceField: 'availableCopies',
    targetField: 'available_copies',
    required: false,
  },
  { sourceField: 'totalCopies', targetField: 'total_copies', required: false },
  { sourceField: 'costPrice', targetField: 'cost_price', required: false },
  { sourceField: 'edition', targetField: 'edition', required: false },
  { sourceField: 'pages', targetField: 'pages', required: false },
  { sourceField: 'remarks', targetField: 'remarks', required: false },
  {
    sourceField: 'sourceOfFund',
    targetField: 'source_of_fund',
    required: false,
  },
  { sourceField: 'volume', targetField: 'volume', required: false },
  { sourceField: 'year', targetField: 'year', required: false },
];

// Get common field name aliases
const getCommonAliases = (field: string): string[] => {
  const aliases: Record<string, string[]> = {
    title: ['book title', 'name'],
    author: ['writer', 'by'],
    accessionNo: ['accession', 'accession number', 'barcode', 'book id'],
    isbn: ['isbn10', 'isbn13'],
    publisher: ['publishing house', 'press'],
    category: ['genre', 'subject', 'collection code'],
    subcategory: ['sub-category', 'sub genre'],
    location: ['shelf', 'rack', 'call number'],
    availableCopies: ['available', 'copies available'],
    totalCopies: ['total', 'copies', 'quantity'],
    costPrice: ['price', 'cost', 'amount'],
    edition: ['version'],
    pages: ['no. of pages', 'physical description'],
    remarks: ['notes', 'comments', 'note area'],
    sourceOfFund: ['fund', 'source'],
    volume: ['vol'],
    year: ['publication year', 'date', 'copyright'],
  };

  return aliases[field] || [];
};

interface BookImportDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSuccess?: () => void;
}

export function BookImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BookImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [currentStep, setCurrentStep] = useState<
    'upload' | 'mapping' | 'preview' | 'importing' | 'complete'
  >('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importedBooks, setImportedBooks] = useState<ImportedBook[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null
  );
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });
  const [skipHeaderRow, setSkipHeaderRow] = useState(true);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);

  // Reset state when dialog closes
  const handleClose = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setRawData([]);
    setHeaders([]);
    setFieldMapping({});
    setImportedBooks([]);
    setImportPreview(null);
    setImportResults({ success: 0, failed: 0, errors: [] });
    setSkipHeaderRow(true);
    setIsProcessingPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ];

      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please select a CSV or Excel file.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast.error(
          'File size too large. Please select a file smaller than 10MB.'
        );
        return;
      }

      setSelectedFile(file);
      parseFile(file);
    }
  };

  // Parse file based on type
  const parseFile = async (file: File) => {
    try {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        await parseCSV(file);
      } else {
        await parseExcel(file);
      }
    } catch {
      toast.error('Failed to parse file. Please check the file format.');
    }
  };

  // Parse CSV file
  const parseCSV = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (result) => {
          if (result.errors.length > 0) {
            reject(new Error(result.errors[0]?.message || 'Parse error'));
            return;
          }

          const data = result.data as Record<string, unknown>[];
          if (data.length === 0) {
            reject(new Error('File is empty'));
            return;
          }

          const headers = Object.keys(data[0] || {});
          setHeaders(headers);
          setRawData(data);
          setCurrentStep('mapping');
          resolve();
        },
        error: (error) => {
          reject(error);
        },
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      });
    });
  };

  // Parse Excel file
  const parseExcel = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('No sheets found in the file'));
            return;
          }

          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('No sheets found in workbook'));
            return;
          }

          const worksheet = workbook.Sheets[sheetName];

          if (!worksheet) {
            reject(new Error('Could not access worksheet'));
            return;
          }

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            reject(new Error('File is empty'));
            return;
          }

          const headers = (jsonData[0] as string[]).map((h) =>
            String(h).trim()
          );
          const processedData = jsonData.slice(1).map((row: unknown) => {
            const rowArray = row as unknown[];
            const obj: Record<string, unknown> = {};
            headers.forEach((header, index) => {
              if (header) {
                obj[header] = rowArray[index];
              }
            });
            return obj;
          });

          setHeaders(headers);
          setRawData(processedData);
          setCurrentStep('mapping');
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Auto-map fields
  const autoMapFields = useCallback(() => {
    const mapping: Record<string, string> = {};
    console.info('Auto-mapping fields. Headers:', headers);

    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().trim();

      // Try to find matching field
      const matchedField = AVAILABLE_FIELDS.find((field) => {
        const fieldNames = [
          field.targetField.toLowerCase(),
          field.targetField
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim(),
          ...getCommonAliases(field.sourceField),
        ];

        const isMatch = fieldNames.some(
          (name) =>
            normalizedHeader === name ||
            normalizedHeader.includes(name) ||
            name.includes(normalizedHeader)
        );

        if (isMatch) {
          console.info(
            `Matched header "${header}" to field "${field.targetField}"`
          );
        }

        return isMatch;
      });

      if (matchedField) {
        mapping[header] = matchedField.targetField;
      }
    });

    console.info('Final mapping:', mapping);
    setFieldMapping(mapping);
  }, [headers]);

  // Preview import mutation
  const previewImportMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      fieldMappings: FieldMapping[];
      skipHeaderRow: boolean;
    }): Promise<ImportPreviewResult> => {
      try {
        const result = await booksApi.previewImport(
          data.file,
          1000,
          data.fieldMappings,
          data.skipHeaderRow
        );
        // The API returns { success, records, totalRows, ... } directly
        return result;
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Preview failed');
        throw new Error(message);
      }
    },
    onSuccess: (result: ImportPreviewResult) => {
      // Handle the records array - check both result.records and result directly if it's an array
      const records =
        result?.records || (Array.isArray(result) ? result : null);

      if (records && Array.isArray(records) && records.length > 0) {
        const processed: ImportedBook[] = records.map(
          (record, index: number) => ({
            rowNumber: record.rowNumber || index + 1,
            title: record.title || '',
            author: record.author || '',
            isbn: record.isbn || '',
            publisher: record.publisher || '',
            category: record.category || '',
            subcategory: record.subcategory || '',
            location: record.location || '',
            accession_no: record.accession_no || '',
            available_copies: record.available_copies || '',
            total_copies: record.total_copies || '',
            cost_price: record.cost_price || '',
            edition: record.edition || '',
            pages: record.pages || '',
            remarks: record.remarks || '',
            source_of_fund: record.source_of_fund || '',
            volume: record.volume || '',
            year: record.year || '',
            errors: record.errors || [],
            warnings: record.warnings || [],
            isValid:
              !record.errors ||
              (Array.isArray(record.errors) && record.errors.length === 0),
          })
        );

        setImportedBooks(processed);
        setImportPreview({
          totalRows: result?.totalRows || processed.length,
          validRows:
            result?.validRows ?? processed.filter((s) => s.isValid).length,
          invalidRows:
            result?.invalidRows ??
            processed.length - processed.filter((s) => s.isValid).length,
          duplicateRows: result?.duplicateRecords || 0,
          samples: processed, // Store ALL records
        });
        setCurrentStep('preview');
        setCurrentPage(1); // Reset to first page
        setIsProcessingPreview(false);
      } else {
        // No records found - show error and go back to mapping
        console.error('No records in preview result:', result);
        toast.error(
          'No valid records found in the file. Please check your field mappings.'
        );
        setIsProcessingPreview(false);
        setCurrentStep('mapping');
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Preview failed'));
      setIsProcessingPreview(false);
      setCurrentStep('mapping'); // Go back to mapping on error
    },
  });

  // Import books mutation
  const importBooksMutation = useMutation({
    mutationFn: async (data: { file: File; fieldMappings: FieldMapping[] }) => {
      try {
        const result = await booksApi.importBooks(
          data.file,
          data.fieldMappings,
          false
        );
        return result.data;
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Import failed');
        throw new Error(message);
      }
    },
    onSuccess: (result: {
      importedRecords?: number;
      errorRecords?: number;
      errors?: string[];
    }) => {
      setImportResults({
        success: result.importedRecords || 0,
        failed: result.errorRecords || 0,
        errors: result.errors || [],
      });
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['books'] });

      // Call onSuccess callback to refresh the book list
      if (onSuccess) {
        onSuccess();
      }

      if (result.importedRecords > 0) {
        toast.success(`Successfully imported ${result.importedRecords} books`);
      }

      if (result.errorRecords > 0) {
        toast.error(`Failed to import ${result.errorRecords} books`);
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Import failed'));
      setCurrentStep('preview');
    },
  });

  // Process imported data using backend preview
  const processImportedData = useCallback(() => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    // Convert field mapping to backend format
    const mappings = Object.entries(fieldMapping)
      .filter(([, targetField]) => targetField && targetField !== '__ignore__')
      .map(([sourceField, targetField]) => ({
        sourceField,
        targetField,
        required:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)
            ?.required || false,
      }));

    setIsProcessingPreview(true);
    // Don't change step to 'importing' during preview processing
    // The 'importing' step should only be shown when actually importing books
    // Stay on 'mapping' with a loading state until preview is ready
    previewImportMutation.mutate({
      file: selectedFile,
      fieldMappings: mappings,
      skipHeaderRow,
    });
  }, [selectedFile, fieldMapping, previewImportMutation, skipHeaderRow]);

  // Start import
  const handleImport = () => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    const validBooks = importedBooks.filter((s) => s.isValid);
    if (validBooks.length === 0) {
      toast.error('No valid books to import');
      return;
    }

    // Convert field mapping to backend format
    const mappings = Object.entries(fieldMapping)
      .filter(([, targetField]) => targetField && targetField !== '__ignore__')
      .map(([sourceField, targetField]) => ({
        sourceField,
        targetField,
        required:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)
            ?.required || false,
      }));

    setCurrentStep('importing');
    importBooksMutation.mutate({
      file: selectedFile,
      fieldMappings: mappings,
    });
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const response = await booksApi.downloadTemplate();
      const blob = new Blob([response.data as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'book-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch {
      // Fallback to local template generation
      const template = [
        {
          Title: 'Example Book',
          Author: 'John Doe',
          'Accession No': 'ACC001',
          Category: 'Fiction',
          Location: 'Shelf A',
          'Available Copies': '5',
          'Total Copies': '5',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Books');
      XLSX.writeFile(wb, 'book-import-template.xlsx');
    }
  };

  // Initialize field mapping when headers are available
  useEffect(() => {
    if (headers.length > 0 && Object.keys(fieldMapping).length === 0) {
      autoMapFields();
    }
  }, [headers, fieldMapping, autoMapFields]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Calculate paginated samples
  const paginatedSamples = importPreview
    ? importPreview.samples.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )
    : [];

  const totalPages = importPreview
    ? Math.ceil(importPreview.samples.length / itemsPerPage)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Import Books
            </DialogTitle>
            <DialogDescription>
              Import book data from CSV or Excel files
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Progress indicator */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                {['upload', 'mapping', 'preview', 'importing', 'complete'].map(
                  (step, index) => {
                    const stepIndex = [
                      'upload',
                      'mapping',
                      'preview',
                      'importing',
                      'complete',
                    ].indexOf(currentStep);
                    const isActive = currentStep === step;
                    const isPast = stepIndex > index;
                    const isComplete = step === 'complete' && isActive;

                    return (
                      <Fragment key={step}>
                        <div
                          className={`flex items-center gap-2 ${
                            isComplete
                              ? 'text-green-600'
                              : isActive
                                ? 'text-primary'
                                : isPast
                                  ? 'text-green-600'
                                  : 'text-muted-foreground'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              isComplete
                                ? 'bg-green-600 text-white'
                                : isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : isPast
                                    ? 'bg-green-600 text-white'
                                    : 'bg-muted'
                            }`}
                          >
                            {isPast || isComplete ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span className="capitalize text-sm">{step}</span>
                        </div>
                        {index < 4 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Fragment>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {/* Step 1: File Upload */}
            {currentStep === 'upload' && (
              <div className="space-y-6 p-6">
                <div className="text-center">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-primary/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      Select CSV or Excel File
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Choose a file containing book data to import
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <FileIcon className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                </div>

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Selected: {selectedFile.name} (
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">File Requirements</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p>• File format: CSV (.csv) or Excel (.xlsx, .xls)</p>
                    <p>• Maximum file size: 10MB</p>
                    <p>• Required columns: Title, Author</p>
                    <p>
                      • Optional columns: Accession No, ISBN, Publisher,
                      Category, Location, etc.
                    </p>
                    <p>
                      • Accession No: If missing, the system generates a
                      temporary ID.
                    </p>
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Field Mapping */}
            {currentStep === 'mapping' && (
              <div className="space-y-6 p-6 relative">
                {isProcessingPreview && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium">
                        Processing your data...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This may take a moment
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Map Fields</h3>
                  <Button
                    variant="outline"
                    onClick={autoMapFields}
                    disabled={isProcessingPreview}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Auto Map
                  </Button>
                </div>

                <div className="grid gap-4">
                  {headers.map((header) => (
                    <div
                      key={header}
                      className="flex items-center gap-4 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{header}</Label>
                        <p className="text-xs text-muted-foreground">
                          {rawData
                            .slice(0, 3)
                            .map((row) => row[header] || '(empty)')
                            .join(', ')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={fieldMapping[header] || ''}
                        onValueChange={(value) =>
                          setFieldMapping((prev) => ({
                            ...prev,
                            [header]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">
                            Ignore field
                          </SelectItem>
                          {AVAILABLE_FIELDS.map((field) => (
                            <SelectItem
                              key={field.targetField}
                              value={field.targetField}
                            >
                              {field.targetField}{' '}
                              {field.required && (
                                <span className="text-red-500">*</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {currentStep === 'preview' && importPreview && (
              <div className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {importPreview.totalRows}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Total Rows
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {importPreview.validRows}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Valid Rows
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {importPreview.invalidRows}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Invalid Rows
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {importPreview.duplicateRows}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Duplicates
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Sample Data</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">
                              Row
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Accession No
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Title
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Author
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Category
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Location
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSamples.map((book, index) => (
                            <tr
                              key={index}
                              className="border-t hover:bg-muted/50 transition-colors"
                            >
                              <td className="px-4 py-3">{book.rowNumber}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {book.accession_no || (
                                  <span className="italic text-xs">
                                    Will be generated
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">{book.title}</td>
                              <td className="px-4 py-3">{book.author}</td>
                              <td className="px-4 py-3">
                                {book.category || '-'}
                              </td>
                              <td className="px-4 py-3">
                                {book.location || '-'}
                              </td>
                              <td className="px-4 py-3">
                                {book.isValid ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 border-green-200"
                                  >
                                    Valid
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="destructive"
                                    className="hover:bg-destructive/90"
                                  >
                                    Invalid
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                      {Math.min(
                        currentPage * itemsPerPage,
                        importPreview.samples.length
                      )}{' '}
                      of {importPreview.samples.length} entries
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-2 text-sm font-medium">
                        Page {currentPage} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>

                {importPreview.invalidRows > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {importPreview.invalidRows} rows have validation errors
                      and will be skipped during import. Please review your data
                      and field mapping.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Step 4: Importing/Processing */}
            {currentStep === 'importing' && (
              <div className="space-y-6 p-6 text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <h3 className="text-lg font-semibold">
                  {isProcessingPreview
                    ? 'Processing Preview'
                    : 'Importing Books'}
                </h3>
                <p className="text-muted-foreground">
                  {isProcessingPreview
                    ? 'Analyzing your file and validating data...'
                    : 'Importing books into the database...'}
                </p>
                <div className="max-w-md mx-auto">
                  {/* Indeterminate progress bar */}
                  <Progress
                    value={undefined}
                    className="w-full animate-pulse"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Complete */}
            {currentStep === 'complete' && (
              <div className="space-y-6 p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Import Complete
                  </h3>
                  <p className="text-muted-foreground">
                    Book import process has been completed
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {importResults.success}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Successfully Imported
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {importResults.failed}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Failed to Import
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {importResults.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Import Errors:</p>
                        {importResults.errors
                          .slice(0, 5)
                          .map((error, index) => (
                            <p key={index} className="text-sm text-red-600">
                              {typeof error === 'string'
                                ? error
                                : String(error)}
                            </p>
                          ))}
                        {importResults.errors.length > 5 && (
                          <p className="text-sm text-muted-foreground">
                            ... and {importResults.errors.length - 5} more
                            errors
                          </p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="p-6 border-t bg-background mt-auto">
          {currentStep === 'upload' && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipHeader"
                  checked={skipHeaderRow}
                  onCheckedChange={(checked) =>
                    setSkipHeaderRow(checked as boolean)
                  }
                />
                <Label htmlFor="skipHeader">Skip first row (header)</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('upload')}
                  disabled={isProcessingPreview}
                >
                  Back
                </Button>
                <Button
                  onClick={processImportedData}
                  disabled={
                    Object.values(fieldMapping).filter(Boolean).length === 0 ||
                    isProcessingPreview
                  }
                >
                  {isProcessingPreview ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Continue to Preview'
                  )}
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'preview' && importPreview && (
            <div className="flex justify-between w-full items-center">
              <div className="text-sm text-muted-foreground">
                {importPreview.validRows} valid books ready to import
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('mapping')}
                >
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importPreview.validRows === 0}
                >
                  Import {importPreview.validRows} Books
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex justify-between w-full items-center">
              <div />
              <Button onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BookImportDialog;
