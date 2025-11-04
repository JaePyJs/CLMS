import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMobileOptimization, getOptimalImageSize } from '@/hooks/useMobileOptimization';
import { toast } from 'sonner';
import { Upload, Camera, X, CheckCircle, AlertCircle, RefreshCw, Trash2, ZoomIn, Image as ImageIcon } from 'lucide-react';

interface StudentPhotoUploadProps {
  studentId: string;
  studentName: string;
  currentPhotoUrl?: string;
  onUploadComplete?: (photoUrl: string) => void;
}

export function StudentPhotoUpload({
  studentId,
  studentName,
  currentPhotoUrl,
  onUploadComplete
}: StudentPhotoUploadProps) {
  const mobileState = useMobileOptimization();
  const { isMobile, isTablet: _isTablet, width: _width } = mobileState;
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null);
  const [showCamera, setShowCamera] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Maximum file size: 5MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (dataUrl: string) => {
    setIsUploading(true);
    try {
      // Calculate optimal image size based on device
      const targetSizeObj = getOptimalImageSize(mobileState, 400, 400);
      const targetSize = targetSizeObj.width;

      // Create image element
      const img = new Image();
      img.src = dataUrl;

      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      // Create canvas and resize image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = img.width / img.height;
      let newWidth: number = targetSize;
      let newHeight: number = targetSize / aspectRatio;

      if (newHeight > targetSize) {
        newHeight = targetSize;
        newWidth = targetSize * aspectRatio;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;

      // Draw and compress
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedUrl = URL.createObjectURL(blob);
            setPreview(compressedUrl);
            uploadPhoto(blob);
          }
        },
        'image/jpeg',
        0.85
      );
    } catch (error) {
      toast.error('Failed to process image');
      console.error('Image processing error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadPhoto = async (blob: Blob) => {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('photo', blob, `student-${studentId}.jpg`);
      formData.append('studentId', studentId);

      // Upload to server (implement your upload endpoint)
      // const response = await fetch('/api/students/upload-photo', {
      //   method: 'POST',
      //   body: formData,
      // });

      // Simulate upload for now
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success('Photo uploaded successfully!');
      onUploadComplete?.(`/uploads/students/${studentId}.jpg`);
    } catch (error) {
      toast.error('Failed to upload photo');
      console.error('Upload error:', error);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isMobile ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setStream(mediaStream);
      setShowCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast.error('Failed to access camera');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        processImage(url);
        stopCamera();
      }
    }, 'image/jpeg');
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this photo?')) {
      setPreview(null);
      toast.success('Photo deleted');
      onUploadComplete?.('');
    }
  };

  return (
    <>
      <Card className={isMobile ? 'w-full' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Student Photo</span>
            {preview && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Uploaded
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{studentName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo Preview */}
          <div className="relative">
            {preview ? (
              <div className="relative group">
                <img
                  src={preview}
                  alt={studentName}
                  className="w-full h-48 object-cover rounded-lg border-2 border-primary/20"
                  onClick={() => setShowPreview(true)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowPreview(true)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No photo uploaded</p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Actions */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={startCamera}
              disabled={isUploading}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Accepted formats: JPEG, PNG, WebP. Max size: 5MB. Photos are automatically
              optimized for your device.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={stopCamera}>
        <DialogContent className={isMobile ? 'w-full' : 'max-w-2xl'}>
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
            <DialogDescription>
              Position {studentName} in the frame and click capture
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <Button onClick={capturePhoto} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
              <Button onClick={stopCamera} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className={isMobile ? 'w-full' : 'max-w-3xl'}>
          <DialogHeader>
            <DialogTitle>{studentName}</DialogTitle>
          </DialogHeader>
          {preview && (
            <img src={preview} alt={studentName} className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
