import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, CheckCircle, AlertCircle, Info, Loader2, FileText, Users, BookOpen, Eye, FileSpreadsheet, FileDown, ArrowRight, ArrowLeft, RefreshCw, Database, Zap } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: string[];
}

interface FieldMapping {
  source: string;
  target: string;
  required: boolean;
}

interface PreviewData {
  headers: string[];
  rows: any[][];
  totalRows: number;
}

export default function EnhancedImportManager() {
  const [activeTab, setActiveTab] = useState('students');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File): Promise<{ headers: string[]; rows: any[]; totalRows: number }> => {
    return new Promise((resolve, reject) => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          preview: 10,
          complete: (results) => {
            if (results.errors.length > 0) {
              const firstError = results.errors[0];
              reject(new Error(`CSV parsing error: ${firstError?.message || 'Unknown error'}`));
            } else {
              const headers = results.meta.fields || [];
              const rows = results.data as any[];
              resolve({
                headers,
                rows: rows.slice(0, 10),
                totalRows: results.data.length
              });
            }
          },
          error: (error) => reject(error)
        });
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result;
            if (!result) {
              reject(new Error('Failed to read file'));
              return;
            }
            const data = new Uint8Array(result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
              reject(new Error('No sheets found in Excel file'));
              return;
            }
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = (XLSX.utils.sheet_to_json as any)(worksheet, { header: 1 });

            if (jsonData.length === 0) {
              reject(new Error('Excel file is empty'));
              return;
            }

            const headers = (jsonData[0] as string[]) || [];
            const dataRows = jsonData.slice(1) as any[][];
            const objectRows = dataRows.map((row: any[]) => {
              const obj: Record<string, any> = {};
              headers.forEach((header, index) => {
                obj[header] = row[index] || '';
              });
              return obj;
            });

            resolve({
              headers,
              rows: objectRows.slice(0, 10),
              totalRows: dataRows.length
            });
          } catch (error) {
            reject(new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format. Please use CSV, XLS, or XLSX files.'));
      }
    });
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setPreviewData(null);
    setFieldMapping([]);

    try {
      setLoading(true);
      const data = await parseFile(selectedFile);
      setPreviewData(data);

      // Auto-detect field mapping based on headers
      const detectedMapping = detectFieldMapping(data.headers, activeTab);
      setFieldMapping(detectedMapping);
      setShowPreview(true);
    } catch (error) {
      toast.error(`Failed to parse file: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const detectFieldMapping = (headers: string[], type: string): FieldMapping[] => {
    const availableFields = headers.map(h => h.toLowerCase().trim());

    if (type === 'students') {
      const studentFields = ['name', 'firstname', 'lastname', 'studentid', 'gradelevel', 'gradecategory', 'section', 'email', 'phone'];
      const mapping: FieldMapping[] = [];

      availableFields.forEach(header => {
        if (studentFields.includes(header)) {
          let target = header;
          if (header === 'firstname') target = 'firstName';
          if (header === 'lastname') target = 'lastName';
          if (header === 'studentid') target = 'studentId';
          if (header === 'gradelevel') target = 'gradeLevel';
          if (header === 'gradecategory') target = 'gradeCategory';

          mapping.push({
            source: header,
            target,
            required: ['name', 'firstname', 'lastname', 'gradelevel'].includes(header)
          });
        }
      });

      return mapping;
    } else if (type === 'books') {
      const bookFields = ['accessionno', 'title', 'author', 'isbn', 'edition', 'category', 'publisher', 'year'];
      const mapping: FieldMapping[] = [];

      availableFields.forEach(header => {
        if (bookFields.includes(header)) {
          let target = header;
          if (header === 'accessionno') target = 'accessionNo';

          mapping.push({
            source: header,
            target,
            required: ['accessionno', 'title', 'author'].includes(header)
          });
        }
      });

      return mapping;
    }

    return [];
  };

  const applyFieldMapping = (rows: any[]): any[] => {
    return rows.map(row => {
      const mapped: any = {};

      fieldMapping.forEach(mapping => {
        const sourceValue = row[mapping.source];
        if (sourceValue !== undefined && sourceValue !== '') {
          mapped[mapping.target] = sourceValue;
        }
      });

      // Special handling for name field
      if (mapped.name && !mapped.firstName && !mapped.lastName) {
        const nameParts = mapped.name.split(',').map((p: string) => p.trim());
        if (nameParts.length >= 2) {
          mapped.lastName = nameParts[0];
          mapped.firstName = nameParts[1];
        } else if (nameParts.length === 1) {
          const spaceParts = nameParts[0].split(' ');
          if (spaceParts.length >= 2) {
            mapped.firstName = spaceParts[0];
            mapped.lastName = spaceParts.slice(1).join(' ');
          } else {
            mapped.firstName = nameParts[0];
          }
        }
      }

      return mapped;
    });
  };

  const handleImport = async () => {
    if (!file || !fieldMapping.length) {
      toast.error('Please select a file and configure field mapping');
      return;
    }

    const token = localStorage.getItem('clms_token');
    if (!token) {
      toast.error('Please login first to import data');
      return;
    }

    setLoading(true);
    setImportProgress(0);
    setResult(null);

    try {
      // Parse the complete file
      const completeData = await parseFile(file);
      applyFieldMapping(completeData.rows);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(fieldMapping));

      const endpoint = activeTab === 'students' ? '/import/students' : '/import/books';

      const response = await axios.post(`${API_BASE_URL}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total!);
          setImportProgress(progress);
        },
      });

      setResult(response.data.data);
      setFile(null);
      setPreviewData(null);
      setFieldMapping([]);
      setShowPreview(false);

      if (fileInputRef.current) fileInputRef.current.value = '';

      toast.success(`Import completed: ${response.data.data.importedRecords} ${activeTab} imported`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import data');
    } finally {
      setLoading(false);
      setImportProgress(0);
    }
  };

  const downloadTemplate = async (type: 'students' | 'books', format: 'csv' | 'xlsx') => {
    const token = localStorage.getItem('clms_token');
    if (!token) {
      toast.error('Please login first to download templates');
      return;
    }

    try {
      let data: string;
      let filename: string;
      let mimeType: string;

      if (type === 'students') {
        const headers = ['name', 'gradeLevel', 'section', 'email', 'phone'];
        const sampleData = [
          ['Doe, John', '10', 'A', 'john.doe@school.edu', '555-0123'],
          ['Smith, Jane', '11', 'B', 'jane.smith@school.edu', '555-0124'],
          ['Johnson, Mike', '9', 'A', 'mike.johnson@school.edu', '555-0125'],
        ];

        data = [headers, ...sampleData].map(row => row.join(',')).join('\n');
        filename = `students-template.${format}`;
        mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        if (format === 'xlsx') {
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
          data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        }
      } else {
        const headers = ['accessionNo', 'title', 'author', 'isbn', 'category', 'publisher', 'year'];
        const sampleData = [
          ['B001', 'To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Fiction', 'J.B. Lippincott & Co.', '1960'],
          ['B002', '1984', 'George Orwell', '9780451524935', 'Fiction', 'Secker & Warburg', '1949'],
          ['B003', 'The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Fiction', 'Charles Scribner\'s Sons', '1925'],
        ];

        data = [headers, ...sampleData].map(row => row.join(',')).join('\n');
        filename = `books-template.${format}`;
        mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        if (format === 'xlsx') {
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Books');
          data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        }
      }

      const blob = new Blob([data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} template downloaded`);
    } catch (err) {
      toast.error('Failed to download template');
    }
  };

  const renderPreview = () => {
    if (!previewData) return null;

    return (
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              File Preview - {file?.name}
            </DialogTitle>
            <DialogDescription>
              Preview of first 10 rows from {previewData.totalRows} total records
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-gray-600">
                  {previewData.totalRows} rows • {previewData.headers.length} columns
                </p>
              </div>
            </div>

            {/* Field Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Field Mapping Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fieldMapping.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>No fields detected</AlertTitle>
                      <AlertDescription>
                        Please ensure your file contains recognizable column headers.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    fieldMapping.map((mapping, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded">
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {mapping.source}
                        </span>
                        <span className="text-gray-500">→</span>
                        <span className="font-mono text-sm bg-blue-100 px-2 py-1 rounded">
                          {mapping.target}
                        </span>
                        {mapping.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Data Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.headers.map((header, index) => (
                          <TableHead key={index} className="font-mono text-xs">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {previewData.headers.map((header, colIndex) => (
                            <TableCell key={colIndex} className="font-mono text-xs">
                              {(row as Record<string, any>)[header] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || fieldMapping.length === 0}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {activeTab === 'students' ? 'Students' : 'Books'}
                </>
              )}
            </Button>
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-center text-gray-600">
                {importProgress}% complete
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const renderImportResult = () => {
    if (!result) return null;

    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5" />
            Import Results
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Badge variant="secondary" className="justify-center py-2">
              <Info className="h-4 w-4 mr-1" />
              Total: {result.totalRecords}
            </Badge>
            <Badge className="justify-center py-2 bg-green-500 hover:bg-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              Imported: {result.importedRecords}
            </Badge>
            <Badge variant="outline" className="justify-center py-2 border-yellow-500 text-yellow-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              Skipped: {result.skippedRecords}
            </Badge>
            <Badge variant="destructive" className="justify-center py-2">
              <AlertCircle className="h-4 w-4 mr-1" />
              Errors: {result.errorRecords}
            </Badge>
          </div>

          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Details ({result.errors.length})</AlertTitle>
              <AlertDescription>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                  {result.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm">• {error}</div>
                  ))}
                  {result.errors.length > 10 && (
                    <div className="text-sm italic">... and {result.errors.length - 10} more</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setResult(null)}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Import Another File
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              <Zap className="h-4 w-4 mr-2" />
              Start Fresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Enhanced Import Manager</h2>
        <p className="text-muted-foreground">Import students and books from CSV or Excel files with intelligent field mapping</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="students">
            <Users className="h-4 w-4 mr-2" />
            Students
          </TabsTrigger>
          <TabsTrigger value="books">
            <BookOpen className="h-4 w-4 mr-2" />
            Books
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Enhanced Student Import</AlertTitle>
            <AlertDescription>
              <strong>Supported formats:</strong> CSV, XLS, XLSX
              <br />
              <strong>Auto-detects:</strong> Name format, field mapping, data types
              <br />
              <strong>Template formats:</strong> Standard (name, grade, section) or Detailed (separate first/last names)
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Downloads */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Download Templates:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate('students', 'csv')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    CSV Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate('students', 'xlsx')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Excel Template
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Select File:</p>
                <input
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  id="student-file-upload"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="student-file-upload">
                  <Button variant="secondary" asChild disabled={loading}>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Select CSV or Excel File
                    </span>
                  </Button>
                </label>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={!file || !previewData}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview & Configure
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || !fieldMapping.length || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Students
                    </>
                  )}
                </Button>
              </div>

              {loading && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-center text-gray-600">
                    Processing: {importProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {renderImportResult()}
        </TabsContent>

        <TabsContent value="books" className="space-y-4 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Enhanced Book Import</AlertTitle>
            <AlertDescription>
              <strong>Supported formats:</strong> CSV, XLS, XLSX
              <br />
              <strong>Auto-detects:</strong> Field mapping, data types, categories
              <br />
              <strong>Template formats:</strong> Basic (accession, title, author) or Detailed (complete metadata)
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Downloads */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Download Templates:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate('books', 'csv')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    CSV Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate('books', 'xlsx')}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Excel Template
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Select File:</p>
                <input
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  id="book-file-upload"
                  type="file"
                  onChange={handleFileChange}
                />
                <label htmlFor="book-file-upload">
                  <Button variant="secondary" asChild disabled={loading}>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Select CSV or Excel File
                    </span>
                  </Button>
                </label>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPreview(true)}
                  disabled={!file || !previewData}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview & Configure
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || !fieldMapping.length || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Books
                    </>
                  )}
                </Button>
              </div>

              {loading && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-center text-gray-600">
                    Processing: {importProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {renderImportResult()}
        </TabsContent>
      </Tabs>

      {renderPreview()}
    </div>
  );
}