import React, { useState } from 'react';
import { useMobileOptimization, getResponsiveClasses } from '@/hooks/useMobileOptimization';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import {
  User,
  Mail,
  Phone,
  School,
  Calendar,
  CreditCard,
  QrCode,
  Download,
  Printer,
  Share2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gradeCategory: string;
  section?: string;
  isActive: boolean;
  email?: string;
  phone?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  qrCodeGenerated: boolean;
  barcodeGenerated: boolean;
  libraryCardPrinted: boolean;
  joinDate: string;
  totalSessions: number;
}

interface StudentBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

export function StudentBarcodeDialog({
  open,
  onOpenChange,
  student
}: StudentBarcodeDialogProps) {
  const { isMobile, isTablet, isDesktop } = useMobileOptimization();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!student) return null;

  const handleGenerateCodes = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call for generating codes
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Barcode and QR code generated successfully!');
    } catch (error) {
      toast.error('Failed to generate codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintID = async () => {
    setIsPrinting(true);
    try {
      // Simulate printing
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('ID card sent to printer!');
    } catch (error) {
      toast.error('Failed to print ID card');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadBarcode = () => {
    // Create download link for barcode
    const barcodeElement = document.querySelector('#barcode-svg svg');
    if (barcodeElement) {
      const svgData = new XMLSerializer().serializeToString(barcodeElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const downloadLink = document.createElement('a');
      downloadLink.href = svgUrl;
      downloadLink.download = `${student.studentId}-barcode.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('Barcode downloaded!');
    }
  };

  const handleDownloadQR = () => {
    // Find QR code image and download
    const qrImage = document.querySelector('#qr-code img') as HTMLImageElement;
    if (qrImage && qrImage.src) {
      const downloadLink = document.createElement('a');
      downloadLink.href = qrImage.src;
      downloadLink.download = `${student.studentId}-qrcode.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('QR code downloaded!');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl ${getResponsiveClasses('', { isMobile, isTablet, isDesktop })}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card - {student.firstName} {student.lastName}
          </DialogTitle>
          <DialogDescription>
            Generate and manage barcode and QR code for student identification
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Student Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Student Information
                </span>
                <Badge variant={student.isActive ? 'default' : 'secondary'}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Student ID:</span>
                    <span className="text-sm font-bold">{student.studentId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">Grade:</span>
                    <span className="text-sm">{student.gradeLevel} {student.section && `- Section ${student.section}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-600">Joined:</span>
                    <span className="text-sm">{formatDate(student.joinDate)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-600">{student.email}</span>
                    </div>
                  )}
                  {student.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span className="text-sm text-gray-600">{student.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <School className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-600">{student.totalSessions} library sessions</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Codes Generation Status */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {student.barcodeGenerated ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm">Barcode Generated</span>
                </div>
                <div className="flex items-center gap-2">
                  {student.qrCodeGenerated ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm">QR Code Generated</span>
                </div>
                <div className="flex items-center gap-2">
                  {student.libraryCardPrinted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm">ID Card Printed</span>
                </div>
              </div>
              <Button
                onClick={handleGenerateCodes}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Generate Missing Codes'}
              </Button>
            </CardContent>
          </Card>

          {/* Barcode and QR Code Display */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Barcode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Barcode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div id="barcode-svg">
                  <BarcodeDisplay
                    value={student.studentId}
                    format="CODE128"
                    width={2}
                    height={80}
                    displayValue={true}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadBarcode}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div id="qr-code">
                  <QRCodeDisplay
                    value={student.studentId}
                    size={150}
                    margin={1}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handlePrintID}
              disabled={isPrinting}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isPrinting ? 'Printing...' : 'Print ID Card'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info('Share functionality coming soon!');
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StudentBarcodeDialog;