import React, { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { studentsApi } from '@/lib/api';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, ArrowRight, Settings, File, Users, Loader2, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Types for import functionality
interface ImportedStudent {
  rowNumber: number;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  section?: string;
  email?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  address?: string;
  emergencyContact?: string;
  notes?: string;
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
  samples: ImportedStudent[];
}

// Available fields for mapping
const AVAILABLE_FIELDS: FieldMapping[] = [
  { sourceField: 'firstName', targetField: 'firstName', required: true },
  { sourceField: 'lastName', targetField: 'lastName', required: true },
  { sourceField: 'gradeLevel', targetField: 'gradeLevel', required: true },
  { sourceField: 'section', targetField: 'section', required: false },
  { sourceField: 'email', targetField: 'email', required: false },
  { sourceField: 'phone', targetField: 'phone', required: false },
  { sourceField: 'parentName', targetField: 'parentName', required: false },
  { sourceField: 'parentPhone', targetField: 'parentPhone', required: false },
  { sourceField: 'parentEmail', targetField: 'parentEmail', required: false },
  { sourceField: 'address', targetField: 'address', required: false },
  { sourceField: 'emergencyContact', targetField: 'emergencyContact', required: false },
  { sourceField: 'notes', targetField: 'notes', required: false },
];

interface StudentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentImportDialog({ open, onOpenChange }: StudentImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importedStudents, setImportedStudents] = useState<ImportedStudent[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });
  const [skipHeaderRow, setSkipHeaderRow] = useState(true);
  // Reset state when dialog closes
  const handleClose = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setRawData([]);
    setHeaders([]);
    setFieldMapping({});
    setImportedStudents([]);
    setImportPreview(null);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, errors: [] });
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
        'text/plain'
      ];

      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please select a CSV or Excel file.');
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size too large. Please select a file smaller than 10MB.');
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
    } catch (error) {
      toast.error('Failed to parse file. Please check the file format.');
      console.error('Parse error:', error);
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

          const data = result.data as any[];
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
        transformHeader: (header) => header.trim(),
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
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            reject(new Error('File is empty'));
            return;
          }

          const headers = (jsonData[0] as string[]).map(h => String(h).trim());
          const processedData = jsonData.slice(1).map((row: unknown) => {
            const rowArray = row as any[];
            const obj: any = {};
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

    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();

      // Try to find matching field
      const matchedField = AVAILABLE_FIELDS.find(field => {
        const fieldNames = [
          field.targetField.toLowerCase(),
          field.targetField.replace(/([A-Z])/g, ' $1').toLowerCase().trim(),
          ...getCommonAliases(field.targetField)
        ];

        return fieldNames.some(name =>
          normalizedHeader === name ||
          normalizedHeader.includes(name) ||
          name.includes(normalizedHeader)
        );
      });

      if (matchedField) {
        mapping[header] = matchedField.targetField;
      }
    });

    setFieldMapping(mapping);
  }, [headers]);

  // Get common field name aliases
  const getCommonAliases = (field: string): string[] => {
    const aliases: Record<string, string[]> = {
      firstName: ['first', 'given name', 'forename', 'fname'],
      lastName: ['last', 'surname', 'family name', 'lname'],
      gradeLevel: ['grade', 'year', 'level', 'grade level', 'class'],
      section: ['section', 'block', 'group'],
      email: ['email', 'e-mail', 'email address'],
      phone: ['phone', 'telephone', 'mobile', 'contact', 'phone number'],
      parentName: ['parent name', 'parent', 'guardian', 'parent/guardian'],
      parentPhone: ['parent phone', 'parent mobile', 'parent contact'],
      parentEmail: ['parent email', 'parent e-mail'],
      address: ['address', 'home address', 'residence'],
      emergencyContact: ['emergency contact', 'emergency phone'],
      notes: ['notes', 'remarks', 'comments', 'observations']
    };

    return aliases[field] || [];
  };

  // Preview import mutation
  const previewImportMutation = useMutation({
    mutationFn: async (data: { file: File; fieldMappings: any[] }) => {
      try {
        const result = await studentsApi.importStudents(data.file, data.fieldMappings, true);
        return result.data;
      } catch (error: any) {
        throw new Error(error?.error || error?.message || 'Preview failed');
      }
    },
    onSuccess: (result: any) => {
      if (result.records && Array.isArray(result.records)) {
        const processed: ImportedStudent[] = result.records.map((record: any, index: number) => ({
          rowNumber: index + 1,
          firstName: record.firstName || '',
          lastName: record.lastName || '',
          gradeLevel: record.gradeLevel || '',
          section: record.section || '',
          email: record.email || '',
          phone: record.phone || '',
          parentName: record.parentName || '',
          parentPhone: record.parentPhone || '',
          parentEmail: record.parentEmail || '',
          address: record.address || '',
          emergencyContact: record.emergencyContact || '',
          notes: record.notes || '',
          errors: record.errors || [],
          warnings: record.warnings || [],
          isValid: !(record.errors && record.errors.length > 0)
        }));

        const validCount = processed.filter(s => s.isValid).length;
        const invalidCount = processed.length - validCount;

        setImportedStudents(processed);
        setImportPreview({
          totalRows: processed.length,
          validRows: validCount,
          invalidRows: invalidCount,
          duplicateRows: result.duplicateRecords || 0,
          samples: processed.slice(0, 5)
        });
        setCurrentStep('preview');
      }
    },
    onError: (error: any) => {
      toast.error(`Preview failed: ${error?.message || 'Unknown error'}`);
    }
  });

  // Import students mutation
  const importStudentsMutation = useMutation({
    mutationFn: async (data: { file: File; fieldMappings: any[] }) => {
      try {
        const result = await studentsApi.importStudents(data.file, data.fieldMappings, false);
        return result.data;
      } catch (error: any) {
        throw new Error(error?.error || error?.message || 'Import failed');
      }
    },
    onSuccess: (result: any) => {
      setImportResults({
        success: result.importedRecords || 0,
        failed: result.errorRecords || 0,
        errors: result.errors || []
      });
      setCurrentStep('complete');
      queryClient.invalidateQueries({ queryKey: ['students'] });

      if (result.importedRecords > 0) {
        toast.success(`Successfully imported ${result.importedRecords} students`);
      }

      if (result.errorRecords > 0) {
        toast.error(`Failed to import ${result.errorRecords} students`);
      }
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error?.message || 'Unknown error'}`);
      setCurrentStep('preview');
    }
  });

  // Process imported data using backend preview
  const processImportedData = useCallback(() => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    // Convert field mapping to backend format
    const mappings = Object.entries(fieldMapping)
      .filter(([_, targetField]) => targetField)
      .map(([sourceField, targetField]) => ({
        sourceField,
        targetField,
        required: AVAILABLE_FIELDS.find(f => f.targetField === targetField)?.required || false
      }));

    setCurrentStep('importing');
    previewImportMutation.mutate({ file: selectedFile, fieldMappings: mappings });
  }, [selectedFile, fieldMapping, previewImportMutation]);

  // Start import
  const handleImport = () => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }

    const validStudents = importedStudents.filter(s => s.isValid);
    if (validStudents.length === 0) {
      toast.error('No valid students to import');
      return;
    }

    // Convert field mapping to backend format
    const mappings = Object.entries(fieldMapping)
      .filter(([_, targetField]) => targetField)
      .map(([sourceField, targetField]) => ({
        sourceField,
        targetField,
        required: AVAILABLE_FIELDS.find(f => f.targetField === targetField)?.required || false
      }));

    setCurrentStep('importing');
    importStudentsMutation.mutate({ file: selectedFile, fieldMappings: mappings });
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
    } catch (error) {
      // Fallback to local template generation
      const template = [
        {
          'First Name': 'Juan',
          'Last Name': 'Dela Cruz',
          'Grade Level': 'Grade 5',
          'Section': 'A',
          'Email': 'juan.delacruz@email.com',
          'Phone': '+63 912 345 6789',
          'Parent Name': 'Maria Dela Cruz',
          'Parent Phone': '+63 912 345 6788',
          'Parent Email': 'maria.parent@email.com',
          'Address': '123 Main St, City',
          'Emergency Contact': '+63 912 345 6787',
          'Notes': 'Regular visitor, prefers computer sessions'
        }
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Students
          </DialogTitle>
          <DialogDescription>
            Import student data from CSV or Excel files
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg mb-4">
            <div className="flex items-center gap-2 flex-1">
              {['upload', 'mapping', 'preview', 'importing', 'complete'].map((step, index) => (
                <Fragment key={step}>
                  <div className={`flex items-center gap-2 ${
                    currentStep === step ? 'text-primary' :
                    ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(currentStep) > index ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep === step ? 'bg-primary text-primary-foreground' :
                      ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(currentStep) > index ? 'bg-green-600 text-white' : 'bg-muted'
                    }`}>
                      {['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(currentStep) > index ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="capitalize text-sm">{step}</span>
                  </div>
                  {index < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </Fragment>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {/* Step 1: File Upload */}
            {currentStep === 'upload' && (
              <div className="space-y-6 p-6">
                <div className="text-center">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-primary/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Select CSV or Excel File</h3>
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
                      <File className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  </div>
                </div>

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
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
                    <p>• Required columns: First Name, Last Name, Grade Level</p>
                    <p>• Optional columns: Section, Email, Phone, Parent Name, Parent Phone, Parent Email, Address, Emergency Contact, Notes</p>
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
              <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Map Fields</h3>
                  <Button variant="outline" onClick={autoMapFields}>
                    <Settings className="h-4 w-4 mr-2" />
                    Auto Map
                  </Button>
                </div>

                <div className="grid gap-4">
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{header}</Label>
                        <p className="text-xs text-muted-foreground">
                          {rawData.slice(0, 3).map((row) => row[header] || '(empty)').join(', ')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={fieldMapping[header] || ''}
                        onValueChange={(value) => setFieldMapping(prev => ({
                          ...prev,
                          [header]: value
                        }))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ignore field</SelectItem>
                          {AVAILABLE_FIELDS.map((field) => (
                            <SelectItem key={field.targetField} value={field.targetField}>
                              {field.targetField} {field.required && <span className="text-red-500">*</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <Checkbox
                    id="skipHeader"
                    checked={skipHeaderRow}
                    onCheckedChange={(checked) => setSkipHeaderRow(checked as boolean)}
                  />
                  <Label htmlFor="skipHeader">Skip first row (header)</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                    Back
                  </Button>
                  <Button
                    onClick={processImportedData}
                    disabled={Object.values(fieldMapping).filter(Boolean).length === 0}
                  >
                    Continue to Preview
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {currentStep === 'preview' && importPreview && (
              <div className="space-y-6 p-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{importPreview.totalRows}</div>
                      <p className="text-sm text-muted-foreground">Total Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{importPreview.validRows}</div>
                      <p className="text-sm text-muted-foreground">Valid Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{importPreview.invalidRows}</div>
                      <p className="text-sm text-muted-foreground">Invalid Rows</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{importPreview.duplicateRows}</div>
                      <p className="text-sm text-muted-foreground">Duplicates</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Sample Data</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2 text-sm">Row</th>
                          <th className="text-left p-2 text-sm">Name</th>
                          <th className="text-left p-2 text-sm">Grade</th>
                          <th className="text-left p-2 text-sm">Section</th>
                          <th className="text-left p-2 text-sm">Email</th>
                          <th className="text-left p-2 text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.samples.map((student) => (
                          <tr key={student.rowNumber} className="border-t">
                            <td className="p-2 text-sm">{student.rowNumber}</td>
                            <td className="p-2 text-sm">
                              {student.firstName} {student.lastName}
                            </td>
                            <td className="p-2 text-sm">{student.gradeLevel}</td>
                            <td className="p-2 text-sm">{student.section || '-'}</td>
                            <td className="p-2 text-sm">{student.email || '-'}</td>
                            <td className="p-2 text-sm">
                              {student.isValid ? (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Valid
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="h-3 w-3 mr-1" />
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

                {importPreview.invalidRows > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {importPreview.invalidRows} rows have validation errors and will be skipped during import.
                      Please review your data and field mapping.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
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

            {/* Step 4: Importing */}
            {currentStep === 'importing' && (
              <div className="space-y-6 p-6 text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <h3 className="text-lg font-semibold">Importing Students</h3>
                <p className="text-muted-foreground">
                  Please wait while we import the students...
                </p>
                <div className="max-w-md mx-auto">
                  <Progress value={importProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {importProgress}% Complete
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
                  <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
                  <p className="text-muted-foreground">
                    Student import process has been completed
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
                      <p className="text-sm text-muted-foreground">Successfully Imported</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                      <p className="text-sm text-muted-foreground">Failed to Import</p>
                    </CardContent>
                  </Card>
                </div>

                {importResults.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Import Errors:</p>
                        {importResults.errors.slice(0, 5).map((error, index) => (
                          <p key={index} className="text-sm text-red-600">{error}</p>
                        ))}
                        {importResults.errors.length > 5 && (
                          <p className="text-sm text-muted-foreground">
                            ... and {importResults.errors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleClose}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StudentImportDialog;