import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { studentsApi } from '@/lib/api';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowRight,
  Settings,
  File as FileIcon,
  Users,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileEdit,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getErrorMessage } from '@/utils/errorHandling';

// Types for import functionality
interface ImportedStudent {
  rowNumber: number;
  student_id?: string;
  barcode?: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  section?: string;
  email?: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  address?: string;
  emergency_contact?: string;
  notes?: string;
  gender?: string;
  designation?: string;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  label: string;
  required: boolean;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  samples: ImportedStudent[];
}

// Available fields for mapping
const AVAILABLE_FIELDS: FieldMapping[] = [
  {
    sourceField: 'fullName',
    targetField: 'full_name',
    label: 'Full Name',
    required: false,
  },
  {
    sourceField: 'firstName',
    targetField: 'first_name',
    label: 'First Name',
    required: true,
  },
  {
    sourceField: 'lastName',
    targetField: 'last_name',
    label: 'Last Name / Surname',
    required: true,
  },
  {
    sourceField: 'studentId',
    targetField: 'student_id',
    label: 'Student ID',
    required: false,
  },
  {
    sourceField: 'barcode',
    targetField: 'barcode',
    label: 'Barcode',
    required: false,
  },
  {
    sourceField: 'gradeLevel',
    targetField: 'grade_level',
    label: 'Grade Level',
    required: true,
  },
  {
    sourceField: 'section',
    targetField: 'section',
    label: 'Section',
    required: false,
  },
  {
    sourceField: 'email',
    targetField: 'email',
    label: 'Email',
    required: false,
  },
  {
    sourceField: 'phone',
    targetField: 'phone',
    label: 'Phone',
    required: false,
  },
  {
    sourceField: 'parentName',
    targetField: 'parent_name',
    label: 'Parent Name',
    required: false,
  },
  {
    sourceField: 'parentPhone',
    targetField: 'parent_phone',
    label: 'Parent Phone',
    required: false,
  },
  {
    sourceField: 'parentEmail',
    targetField: 'parent_email',
    label: 'Parent Email',
    required: false,
  },
  {
    sourceField: 'address',
    targetField: 'address',
    label: 'Address',
    required: false,
  },
  {
    sourceField: 'emergencyContact',
    targetField: 'emergency_contact',
    label: 'Emergency Contact',
    required: false,
  },
  {
    sourceField: 'notes',
    targetField: 'notes',
    label: 'Notes',
    required: false,
  },
  {
    sourceField: 'gender',
    targetField: 'gender',
    label: 'Gender',
    required: false,
  },
  {
    sourceField: 'designation',
    targetField: 'designation',
    label: 'Designation',
    required: false,
  },
];

// Get common field name aliases
const getCommonAliases = (field: string): string[] => {
  const aliases: Record<string, string[]> = {
    fullName: ['name', 'full name', 'student name', 'fullname'],
    firstName: ['first', 'first name', 'given name', 'forename', 'fname'],
    lastName: [
      'last',
      'last name',
      'surname',
      'family name',
      'lname',
      'sur name',
    ],
    studentId: ['student id', 'id', 'user id', 'student_id', 'lrn', 'userid'],
    // User ID should also be treated as barcode if no separate barcode column
    barcode: [
      'barcode',
      'card number',
      'library card',
      'barcode no',
      'barcode no.',
      'user id',
      'userid',
    ],
    gradeLevel: ['grade', 'year', 'level', 'grade level', 'class'],
    section: ['section', 'block', 'group'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone', 'telephone', 'mobile', 'contact', 'phone number'],
    parentName: ['parent name', 'parent', 'guardian', 'parent/guardian'],
    parentPhone: ['parent phone', 'parent mobile', 'parent contact'],
    parentEmail: ['parent email', 'parent e-mail'],
    address: ['address', 'home address', 'residence'],
    emergencyContact: ['emergency contact', 'emergency phone'],
    notes: ['notes', 'remarks', 'comments', 'observations'],
    gender: ['sex', 'gender', 'male/female'],
    designation: ['designation', 'role', 'type'],
  };

  return aliases[field] || [];
};

interface StudentImportDialogProps {
  open: boolean;
   
  onOpenChange: (_open: boolean) => void;
}

export function StudentImportDialog({
  open,
  onOpenChange,
}: StudentImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fixFileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [currentStep, setCurrentStep] = useState<
    'upload' | 'mapping' | 'preview' | 'importing' | 'complete'
  >('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>(
    []
  );
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null
  );

  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    importedStudents: number;
    importedPersonnel: number;
    errors: string[];
  }>({
    success: 0,
    failed: 0,
    importedStudents: 0,
    importedPersonnel: 0,
    errors: [],
  });
  const [generatedBarcodes, setGeneratedBarcodes] = useState<
    Array<{ row: number; barcode: string }>
  >([]);
  const [skipHeaderRow, setSkipHeaderRow] = useState(true);
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);
  // Reset state when dialog closes
  const handleClose = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setRawData([]);
    setHeaders([]);
    setFieldMapping({});
    setImportedStudents([]);
    setImportPreview(null);
    setIsProcessingPreview(false);

    setImportResults({
      success: 0,
      failed: 0,
      importedStudents: 0,
      importedPersonnel: 0,
      errors: [],
    });
    setSkipHeaderRow(true);
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
    }) => {
      try {
        const result = await studentsApi.previewImport(
          data.file,
          'students',
          1000,
          data.fieldMappings,
          data.skipHeaderRow
        );
        return result.data;
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Preview failed');
        throw new Error(message);
      }
    },
    onSuccess: (result: {
      records: Array<Partial<ImportedStudent>>;
      duplicateRecords?: number;
    }) => {
      if (result.records && Array.isArray(result.records)) {
        const processed: ImportedStudent[] = result.records.map(
          (record, index: number) => ({
            rowNumber: index + 1,
            student_id: record.student_id || '',
            barcode: record.barcode || '',
            first_name: record.first_name || '',
            last_name: record.last_name || '',
            grade_level: record.grade_level || '',
            section: record.section || '',
            email: record.email || '',
            phone: record.phone || '',
            parent_name: record.parent_name || '',
            parent_phone: record.parent_phone || '',
            parent_email: record.parent_email || '',
            address: record.address || '',
            emergency_contact: record.emergency_contact || '',
            notes: record.notes || '',
            gender: record.gender || '',
            designation: record.designation || '',
            errors: record.errors || [],
            warnings: record.warnings || [],
            isValid:
              !record.errors ||
              (Array.isArray(record.errors) && record.errors.length === 0),
          })
        );

        setImportedStudents(processed);
        setImportPreview({
          totalRows:
            (result as { totalRows?: number }).totalRows || processed.length,
          validRows:
            (result as { validRows?: number }).validRows ??
            processed.filter((s) => s.isValid).length,
          invalidRows:
            (result as { invalidRows?: number }).invalidRows ??
            processed.length - processed.filter((s) => s.isValid).length,
          duplicateRows: result.duplicateRecords || 0,
          samples: processed, // Store ALL records
        });
        setCurrentStep('preview');
        setCurrentPage(1); // Reset to first page
        setIsProcessingPreview(false);
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Preview failed'));
      setIsProcessingPreview(false);
    },
  });

  // Import students mutation
  const importStudentsMutation = useMutation({
    mutationFn: async (data: { file: File; fieldMappings: FieldMapping[] }) => {
      try {
        const result = await studentsApi.importStudents(
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
      importedStudents?: number;
      importedPersonnel?: number;
      errorRecords?: number;
      errors?: string[];
      generated?: Array<{ row: number; barcode: string }>;
    }) => {
      setImportResults({
        success: result.importedRecords || 0,
        failed: result.errorRecords || 0,
        importedStudents: result.importedStudents || 0,
        importedPersonnel: result.importedPersonnel || 0,
        errors: result.errors || [],
      });
      setGeneratedBarcodes(
        Array.isArray(result.generated) ? result.generated : []
      );
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['students'] });

      if (result.importedRecords > 0) {
        const duplicateNote =
          importPreview && importPreview.duplicateRows > 0
            ? ` (${importPreview.duplicateRows} duplicates updated)`
            : '';
        const breakdown =
          result.importedStudents && result.importedPersonnel
            ? ` (${result.importedStudents} students, ${result.importedPersonnel} personnel)`
            : '';
        toast.success(
          `Successfully imported ${result.importedRecords} records${duplicateNote}${breakdown}`
        );
      }

      if (result.errorRecords > 0) {
        toast.error(`Failed to import ${result.errorRecords} records`);
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Import failed'));
      setCurrentStep('preview');
    },
  });

  // Fix names mutation - updates last_name from CSV for existing records
  const fixNamesMutation = useMutation({
    mutationFn: async (file: File) => {
      const result = await studentsApi.fixStudentNames(file);
      return result.data;
    },
    onSuccess: (result: {
      updated?: number;
      notFound?: number;
      errors?: string[];
    }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(
        `Fixed ${result.updated || 0} student names. ${result.notFound || 0} not found.`
      );
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors occurred during fix`);
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Fix names failed'));
    },
  });

  // Handle fix file selection
  const handleFixFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      fixNamesMutation.mutate(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

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
        label:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)?.label ||
          targetField,
        required:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)
            ?.required || false,
      }));

    // Don't change step to 'importing' during preview processing
    // The 'importing' step should only be shown when actually importing students
    // Stay on 'mapping' with a loading state until preview is ready
    setIsProcessingPreview(true);
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

    const validStudents = importedStudents.filter((s) => s.isValid);
    if (validStudents.length === 0) {
      toast.error('No valid students to import');
      return;
    }

    // Convert field mapping to backend format
    const mappings = Object.entries(fieldMapping)
      .filter(([, targetField]) => targetField && targetField !== '__ignore__')
      .map(([sourceField, targetField]) => ({
        sourceField,
        targetField,
        label:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)?.label ||
          targetField,
        required:
          AVAILABLE_FIELDS.find((f) => f.targetField === targetField)
            ?.required || false,
      }));

    console.info('[Import Debug] Sending Mappings:', mappings);
    console.info(
      '[Import Debug] Sending File:',
      selectedFile.name,
      selectedFile.size
    );

    setCurrentStep('importing');
    importStudentsMutation.mutate({
      file: selectedFile,
      fieldMappings: mappings,
    });
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const response = await studentsApi.downloadTemplate();
      const blob = new Blob([response.data as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch {
      // Fallback to local template generation
      const template = [
        {
          'First Name': 'Juan',
          'Last Name': 'Dela Cruz',
          'Grade Level': 'Grade 5',
          Section: 'A',
          Email: 'juan.delacruz@email.com',
          Phone: '+63 912 345 6789',
          'Parent Name': 'Maria Dela Cruz',
          'Parent Phone': '+63 912 345 6788',
          'Parent Email': 'maria.parent@email.com',
          Address: '123 Main St, City',
          'Emergency Contact': '+63 912 345 6787',
          Notes: 'Regular visitor, prefers computer sessions',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students');
      XLSX.writeFile(wb, 'student-import-template.xlsx');
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
              <Users className="h-5 w-5" />
              Import Students
            </DialogTitle>
            <DialogDescription>
              Import student data from CSV or Excel files
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Progress indicator */}
          <div className="px-6 pb-6 pt-2">
            <div className="relative flex items-center justify-between w-full max-w-3xl mx-auto">
              {/* Connecting Line */}
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full" />
              <div
                className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary transition-all duration-500 ease-in-out -z-10 rounded-full"
                style={{
                  width: `${
                    ([
                      'upload',
                      'mapping',
                      'preview',
                      'importing',
                      'complete',
                    ].indexOf(currentStep) /
                      4) *
                    100
                  }%`,
                }}
              />

              {[
                { id: 'upload', label: 'Upload' },
                { id: 'mapping', label: 'Map Fields' },
                { id: 'preview', label: 'Preview' },
                { id: 'importing', label: 'Import' },
                { id: 'complete', label: 'Done' },
              ].map((step, index) => {
                const steps = [
                  'upload',
                  'mapping',
                  'preview',
                  'importing',
                  'complete',
                ];
                const currentIndex = steps.indexOf(currentStep);
                const isCompleted = currentIndex > index;
                const isCurrent = currentStep === step.id;

                return (
                  <div
                    key={step.id}
                    className="flex flex-col items-center gap-2 bg-background px-2 z-10"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                        isCompleted
                          ? 'bg-primary border-primary text-primary-foreground scale-105'
                          : isCurrent
                            ? 'bg-background border-primary text-primary scale-110 shadow-lg ring-4 ring-primary/10'
                            : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
                        isCurrent ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
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
                      Choose a file containing student data to import
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
                    <p>
                      • Required columns: First Name, Last Name, Grade Level
                    </p>
                    <p>
                      • Optional columns: Section, Email, Phone, Parent Name,
                      Parent Phone, Parent Email, Address, Emergency Contact,
                      Notes
                    </p>
                    <p>
                      • Barcode: If missing, the system generates a unique
                      PN-prefixed barcode (e.g., PN00018). Scanners can read
                      both numeric-only and PN-prefixed codes.
                    </p>
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>

                {/* Fix Names Section */}
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Fix Existing Names
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p className="text-muted-foreground">
                      If student names appear duplicated (e.g., "REENA REENA"
                      instead of "REENA DELA CRUZ"), upload the original CSV
                      file to fix the last names.
                    </p>
                    <input
                      ref={fixFileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFixFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fixFileInputRef.current?.click()}
                      disabled={fixNamesMutation.isPending}
                    >
                      {fixNamesMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Fixing Names...
                        </>
                      ) : (
                        <>
                          <FileEdit className="h-4 w-4 mr-2" />
                          Fix Names from CSV
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
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
                              {field.label}{' '}
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
                              Student ID
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Barcode
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Grade
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Section
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSamples.map((student, index) => (
                            <tr
                              key={index}
                              className="border-t hover:bg-muted/50 transition-colors even:bg-muted/30"
                            >
                              <td className="px-4 py-3">{student.rowNumber}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {student.student_id || (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                  >
                                    Will be generated
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {student.first_name} {student.last_name}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {student.barcode || (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                                  >
                                    Will be generated
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {student.grade_level}
                              </td>
                              <td className="px-4 py-3">{student.section}</td>
                              <td className="px-4 py-3">
                                {student.email || '-'}
                              </td>
                              <td className="px-4 py-3">
                                {student.isValid ? (
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

            {/* Step 4: Importing */}
            {currentStep === 'importing' && (
              <div className="space-y-6 p-6 text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <h3 className="text-lg font-semibold">Importing Students</h3>
                <p className="text-muted-foreground">
                  {importedStudents.filter((s) => s.isValid).length > 0
                    ? `Processing ${importedStudents.filter((s) => s.isValid).length} students. This may take a few minutes for large imports...`
                    : 'Processing your file. This may take a moment...'}
                </p>
                <div className="max-w-md mx-auto space-y-2">
                  {/* Indeterminate progress bar since we don't have real-time progress from backend yet */}
                  <Progress
                    value={undefined}
                    className="w-full animate-pulse"
                  />
                  <p className="text-xs text-muted-foreground">
                    Please keep this window open. Large imports may take up to 5
                    minutes.
                  </p>
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
                    Student import process has been completed
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {importResults.success}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Total Imported
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {importResults.importedStudents}
                      </div>
                      <p className="text-sm text-muted-foreground">Students</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {importResults.importedPersonnel}
                      </div>
                      <p className="text-sm text-muted-foreground">Personnel</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {importResults.failed}
                      </div>
                      <p className="text-sm text-muted-foreground">Failed</p>
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
                {importPreview.validRows} valid students ready to import
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
                  Import {importPreview.validRows} Students
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex justify-between w-full items-center">
              <div>
                {generatedBarcodes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const headers = ['row', 'barcode'];
                      const csv = [headers.join(',')]
                        .concat(
                          generatedBarcodes.map((g) => `${g.row},${g.barcode}`)
                        )
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'generated-barcodes.csv';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    }}
                  >
                    Download Generated Barcodes
                  </Button>
                )}
              </div>
              <Button onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StudentImportDialog;
