import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  FileText,
  Users,
  BookOpen,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = 'http://localhost:3001/api';

interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: string[];
}

export default function ImportData() {
  const [activeTab, setActiveTab] = useState('students');
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);
  const [studentResult, setStudentResult] = useState<ImportResult | null>(null);
  const [bookResult, setBookResult] = useState<ImportResult | null>(null);

  const handleStudentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setStudentFile(file);
      setStudentResult(null);
    }
  };

  const handleBookFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBookFile(file);
      setBookResult(null);
    }
  };

  const handleStudentImport = async () => {
    if (!studentFile) {
      toast.error('Please select a file to import');
      return;
    }

    // Check for token
    const token = localStorage.getItem('clms_token');
    if (!token) {
      toast.error('Please login first to import data');
      return;
    }

    setStudentLoading(true);
    setStudentResult(null);

    const formData = new FormData();
    formData.append('file', studentFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/import/students`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setStudentResult(response.data.data);
      setStudentFile(null);
      toast.success(`Import completed: ${response.data.data.importedRecords} students imported`);
      
      const fileInput = document.getElementById('student-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import students');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleBookImport = async () => {
    if (!bookFile) {
      toast.error('Please select a file to import');
      return;
    }

    // Check for token
    const token = localStorage.getItem('clms_token');
    if (!token) {
      toast.error('Please login first to import data');
      return;
    }

    setBookLoading(true);
    setBookResult(null);

    const formData = new FormData();
    formData.append('file', bookFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/import/books`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setBookResult(response.data.data);
      setBookFile(null);
      toast.success(`Import completed: ${response.data.data.importedRecords} books imported`);
      
      const fileInput = document.getElementById('book-file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import books');
    } finally {
      setBookLoading(false);
    }
  };

  const downloadTemplate = async (type: 'students' | 'books') => {
    // Check for token
    const token = localStorage.getItem('clms_token');
    if (!token) {
      toast.error('Please login first to download templates');
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/import/templates/${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-import-template.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Template downloaded`);
    } catch (err) {
      toast.error(`Failed to download template`);
    }
  };

  const renderImportResult = (result: ImportResult | null) => {
    if (!result) return null;

    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
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
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import Data</h2>
        <p className="text-muted-foreground">Import students and books from CSV files</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-2" />Students</TabsTrigger>
          <TabsTrigger value="books"><BookOpen className="h-4 w-4 mr-2" />Books</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Student CSV Format</AlertTitle>
            <AlertDescription>
              <strong>Required:</strong> name ("Last, First MI"), gradeLevel, section, blank 4th column for barcode
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button variant="outline" onClick={() => downloadTemplate('students')}>
                <Download className="h-4 w-4 mr-2" />Download Template
              </Button>

              <div>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="student-file-upload"
                  type="file"
                  onChange={handleStudentFileChange}
                />
                <label htmlFor="student-file-upload">
                  <Button variant="secondary" asChild disabled={studentLoading}>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />Select CSV File
                    </span>
                  </Button>
                </label>
                {studentFile && <p className="text-sm text-muted-foreground mt-2">Selected: {studentFile.name}</p>}
              </div>

              <Button onClick={handleStudentImport} disabled={!studentFile || studentLoading} className="w-full">
                {studentLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</> : <><Upload className="h-4 w-4 mr-2" />Import Students</>}
              </Button>

              {studentLoading && <Progress value={50} />}
            </CardContent>
          </Card>

          {renderImportResult(studentResult)}
        </TabsContent>

        <TabsContent value="books" className="space-y-4 mt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Book CSV Format</AlertTitle>
            <AlertDescription>
              <strong>Required:</strong> accessionNo, title, author. <strong>Optional:</strong> isbn, edition, volume, pages, publisher, year, sourceOfFund, costPrice, remarks
            </AlertDescription>
          </Alert>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button variant="outline" onClick={() => downloadTemplate('books')}>
                <Download className="h-4 w-4 mr-2" />Download Template
              </Button>

              <div>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="book-file-upload"
                  type="file"
                  onChange={handleBookFileChange}
                />
                <label htmlFor="book-file-upload">
                  <Button variant="secondary" asChild disabled={bookLoading}>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />Select CSV File
                    </span>
                  </Button>
                </label>
                {bookFile && <p className="text-sm text-muted-foreground mt-2">Selected: {bookFile.name}</p>}
              </div>

              <Button onClick={handleBookImport} disabled={!bookFile || bookLoading} className="w-full">
                {bookLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</> : <><Upload className="h-4 w-4 mr-2" />Import Books</>}
              </Button>

              {bookLoading && <Progress value={50} />}
            </CardContent>
          </Card>

          {renderImportResult(bookResult)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
