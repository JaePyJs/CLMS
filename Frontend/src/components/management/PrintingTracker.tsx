import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Download,
  Printer,
  Plus,
  FileText,
  User,
  Users,
  Briefcase,
  RotateCcw,
  Scan,
  Settings,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react';
import { StudentSearchDropdown } from './StudentSearchDropdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Dynamic types - can be extended via pricing management
type PaperSize = string;
type ColorLevel = string;

// Display labels for sizes and colors
const PAPER_SIZE_LABELS: Record<string, string> = {
  SHORT: 'Short (Letter)',
  LONG: 'Long (Legal)',
  A4: 'A4',
};

const COLOR_LEVEL_LABELS: Record<string, string> = {
  BW: 'Black & White',
  HALF_COLOR: 'Half Color',
  FULL_COLOR: 'Full Color',
};

interface Pricing {
  id: string;
  paper_size: PaperSize;
  color_level: ColorLevel;
  price: number;
  is_active: boolean;
}

interface Job {
  id: string;
  student_id?: string;
  guest_name?: string;
  paper_size: PaperSize;
  color_level: ColorLevel;
  pages: number;
  price_per_page: number;
  total_cost: number;
  paid: boolean;
  receipt_no?: string;
  created_at: string;
  student?: {
    first_name: string;
    last_name: string;
    student_id: string;
  };
}

export default function PrintingTracker() {
  const { token } = useAuth();
  const { lastMessage } = useWebSocketContext();
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>('SHORT');
  const [colorLevel, setColorLevel] = useState<ColorLevel>('BW');
  const [pages, setPages] = useState(1);

  const [userType, setUserType] = useState<'STUDENT' | 'PERSONNEL' | 'GUEST'>(
    'STUDENT'
  );
  const [studentId, setStudentId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');

  // Price management state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<number>(0);
  const [newPriceEntry, setNewPriceEntry] = useState({
    paper_size: '',
    color_level: '',
    price: 0,
    customSize: '',
    customColor: '',
  });
  const [showAddPrice, setShowAddPrice] = useState(false);

  // Get unique paper sizes and color levels from pricing data
  const availableSizes = useMemo(() => {
    const sizes = [
      ...new Set(pricing.filter((p) => p.is_active).map((p) => p.paper_size)),
    ];
    return sizes.length > 0 ? sizes : ['SHORT', 'LONG'];
  }, [pricing]);

  const availableColors = useMemo(() => {
    const colors = [
      ...new Set(pricing.filter((p) => p.is_active).map((p) => p.color_level)),
    ];
    return colors.length > 0 ? colors : ['BW', 'HALF_COLOR', 'FULL_COLOR'];
  }, [pricing]);

  // Barcode scanner buffer and input ref
  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Handle barcode scan - auto-select student if it's a student barcode
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    // Check if it's a personnel barcode (starts with PN)
    const isPersonnelBarcode = trimmedBarcode.toUpperCase().startsWith('PN');

    if (isPersonnelBarcode) {
      // For personnel, switch to personnel type but don't auto-fill
      // Personnel should be selected manually from dropdown
      setUserType('PERSONNEL');
      toast.info('Personnel barcode detected. Please select from dropdown.', {
        description: 'Personnel must be selected manually for verification.',
      });
      return;
    }

    // For students, look up and auto-select
    try {
      // Search for student by barcode or student_id
      const res = await apiClient.get<{
        students: Array<{
          id: string;
          student_id: string;
          first_name: string;
          last_name: string;
          grade_category?: string;
          is_active?: boolean;
        }>;
      }>(`/api/students?search=${encodeURIComponent(trimmedBarcode)}&limit=5`);

      if (res.success && res.data?.students && res.data.students.length > 0) {
        // Find exact match by barcode or student_id
        const student = res.data.students.find(
          (s) =>
            s.student_id === trimmedBarcode ||
            s.student_id.toLowerCase() === trimmedBarcode.toLowerCase()
        );

        if (student) {
          // Check if personnel by grade_category
          if (student.grade_category === 'PERSONNEL') {
            setUserType('PERSONNEL');
            toast.info('Personnel detected. Please select from dropdown.');
            return;
          }

          // Auto-select the student
          setUserType('STUDENT');
          setStudentId(student.id);
          setSelectedStudentName(`${student.first_name} ${student.last_name}`);
          toast.success(
            `Student selected: ${student.first_name} ${student.last_name}`,
            {
              description: `ID: ${student.student_id}`,
            }
          );
        } else {
          toast.warning('No exact match found for barcode');
        }
      } else {
        toast.warning('Student not found with this barcode');
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
      toast.error('Failed to look up barcode');
    }
  }, []);

  // Listen for keyboard events (barcode scanner input)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in an input field (except barcode input)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target !== barcodeInputRef.current) {
        return;
      }

      // Clear existing timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // If Enter key, process the buffer
      if (e.key === 'Enter' && barcodeBufferRef.current.length >= 3) {
        handleBarcodeScan(barcodeBufferRef.current);
        barcodeBufferRef.current = '';
        return;
      }

      // Add character to buffer (only alphanumeric)
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        barcodeBufferRef.current += e.key;
      }

      // Auto-clear buffer after 100ms of no input (barcode scanners are fast)
      barcodeTimeoutRef.current = setTimeout(() => {
        // If buffer has content and looks like a barcode, process it
        if (barcodeBufferRef.current.length >= 6) {
          handleBarcodeScan(barcodeBufferRef.current);
        }
        barcodeBufferRef.current = '';
      }, 100);
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [handleBarcodeScan]);

  const loadPricing = async () => {
    try {
      const res = await apiClient.get<Pricing[]>('/api/printing/pricing');
      if (res.success && res.data) {
        setPricing(res.data);
      } else {
        setPricing([]);
        toast.error(res.error || 'Failed to load pricing');
      }
    } catch (e) {
      setPricing([]);
      toast.error(toUserMessage(e));
    }
  };

  const loadJobs = async () => {
    try {
      const res = await apiClient.get<Job[]>('/api/printing/jobs');
      if (res.success && res.data) {
        setJobs(res.data);
      } else {
        setJobs([]);
        toast.error(res.error || 'Failed to load jobs');
      }
    } catch (e) {
      setJobs([]);
      toast.error(toUserMessage(e));
    }
  };

  useEffect(() => {
    loadPricing();
    loadJobs();
  }, []);

  // Real-time updates from WebSocket
  useEffect(() => {
    if (lastMessage) {
      const type = lastMessage.type;
      if (
        type === 'printing_job' ||
        type === 'PRINTING_JOB' ||
        type === 'quick_service' ||
        type === 'QUICK_SERVICE'
      ) {
        loadJobs();
      }
    }
  }, [lastMessage]);

  const activePrice = useMemo(() => {
    const p = pricing.find(
      (x) =>
        x.paper_size === paperSize &&
        x.color_level === colorLevel &&
        x.is_active
    );
    return p?.price || 0;
  }, [pricing, paperSize, colorLevel]);

  const totalCost = useMemo(() => activePrice * pages, [activePrice, pages]);

  // Update existing price
  const updatePrice = async (id: string, newPrice: number) => {
    try {
      const res = await apiClient.put(`/api/printing/pricing/${id}`, {
        price: newPrice,
      });
      if (res.success) {
        toast.success('Price updated');
        setEditingPriceId(null);
        loadPricing();
      } else {
        toast.error(res.error || 'Failed to update price');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  // Add new pricing entry
  const addPricing = async () => {
    const size =
      newPriceEntry.paper_size === 'CUSTOM'
        ? newPriceEntry.customSize.toUpperCase().replace(/\s+/g, '_')
        : newPriceEntry.paper_size;
    const color =
      newPriceEntry.color_level === 'CUSTOM'
        ? newPriceEntry.customColor.toUpperCase().replace(/\s+/g, '_')
        : newPriceEntry.color_level;

    if (!size || !color || newPriceEntry.price <= 0) {
      toast.warning('Please fill all fields with valid values');
      return;
    }

    try {
      const res = await apiClient.post('/api/printing/pricing', {
        paper_size: size,
        color_level: color,
        price: newPriceEntry.price,
        is_active: true,
      });
      if (res.success) {
        toast.success('New pricing added');
        setNewPriceEntry({
          paper_size: '',
          color_level: '',
          price: 0,
          customSize: '',
          customColor: '',
        });
        setShowAddPrice(false);
        loadPricing();
      } else {
        toast.error(res.error || 'Failed to add pricing');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  // Delete/deactivate pricing
  const deletePricing = async (id: string) => {
    if (!confirm('Are you sure you want to remove this pricing?')) return;

    try {
      const res = await apiClient.delete(`/api/printing/pricing/${id}`);
      if (res.success) {
        toast.success('Pricing removed');
        loadPricing();
      } else {
        toast.error(res.error || 'Failed to remove pricing');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const createJob = async () => {
    if ((userType === 'STUDENT' || userType === 'PERSONNEL') && !studentId) {
      toast.warning(
        userType === 'PERSONNEL'
          ? 'Personnel ID required'
          : 'Student ID required'
      );
      return;
    }
    if (userType === 'GUEST' && !guestName) {
      toast.warning('Guest Name required');
      return;
    }
    if (pages <= 0) {
      toast.warning('Pages required');
      return;
    }

    try {
      const res = await apiClient.post<Job>('/api/printing/jobs', {
        student_id:
          userType === 'STUDENT' || userType === 'PERSONNEL'
            ? studentId
            : undefined,
        guest_name: userType === 'GUEST' ? guestName : undefined,
        paper_size: paperSize,
        color_level: colorLevel,
        pages,
      });
      if (res.success && res.data) {
        toast.success('Job created');
        setStudentId('');
        setSelectedStudentName('');
        setGuestName('');
        setPages(1);
        loadJobs();
      } else {
        toast.error(res.error || 'Failed to create job');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const markPaid = async (id: string) => {
    try {
      const res = await apiClient.post<Job>(`/api/printing/jobs/${id}/pay`, {});
      if (res.success) {
        toast.success('Marked paid');
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, paid: true } : j))
        );
      } else {
        toast.error(res.error || 'Failed to mark job paid');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const resetJobs = async () => {
    setResetting(true);
    try {
      const res = await apiClient.delete('/api/printing/jobs/reset');
      if (res.success) {
        toast.success('Print job history cleared');
        setJobs([]);
        setShowResetConfirm(false);
      } else {
        toast.error(res.error || 'Failed to reset jobs');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setResetting(false);
    }
  };

  const downloadReport = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/printing/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `printing_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error('Failed to download report');
    }
  };

  return (
    <Tabs defaultValue="jobs" className="space-y-6">
      <TabsList>
        <TabsTrigger value="jobs">
          <Printer className="h-4 w-4 mr-2" />
          Print Jobs
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4 mr-2" />
          Price Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="jobs" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* New Job Card */}
          <Card className="shadow-md border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                New Print Job
              </CardTitle>
              <CardDescription>
                Record a new printing transaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Paper Size</label>
                  <Select
                    value={paperSize}
                    onValueChange={(v) => setPaperSize(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {PAPER_SIZE_LABELS[size] || size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Color</label>
                  <Select
                    value={colorLevel}
                    onValueChange={(v) => setColorLevel(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColors.map((color) => (
                        <SelectItem key={color} value={color}>
                          {COLOR_LEVEL_LABELS[color] || color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pages</label>
                <Input
                  type="number"
                  min="1"
                  value={pages}
                  onChange={(e) =>
                    setPages(parseInt(e.target.value || '0', 10))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">User Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={userType === 'STUDENT' ? 'default' : 'outline'}
                    onClick={() => {
                      setUserType('STUDENT');
                      setStudentId('');
                      setSelectedStudentName('');
                    }}
                    className="flex-1 transition-all duration-200"
                  >
                    <User className="h-4 w-4 mr-2" /> Student
                  </Button>
                  <Button
                    variant={userType === 'PERSONNEL' ? 'default' : 'outline'}
                    onClick={() => {
                      setUserType('PERSONNEL');
                      setStudentId('');
                      setSelectedStudentName('');
                    }}
                    className="flex-1 transition-all duration-200"
                  >
                    <Briefcase className="h-4 w-4 mr-2" /> Personnel
                  </Button>
                  <Button
                    variant={userType === 'GUEST' ? 'default' : 'outline'}
                    onClick={() => {
                      setUserType('GUEST');
                      setStudentId('');
                      setSelectedStudentName('');
                    }}
                    className="flex-1 transition-all duration-200"
                  >
                    <Users className="h-4 w-4 mr-2" /> Guest
                  </Button>
                </div>
              </div>
              {userType === 'STUDENT' || userType === 'PERSONNEL' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      {userType === 'PERSONNEL' ? 'Personnel' : 'Student'}{' '}
                      (Active Only)
                    </label>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Scan className="h-3 w-3" />
                      <span>Scan barcode to auto-select</span>
                    </div>
                  </div>
                  {selectedStudentName && studentId ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700 dark:text-green-300 flex-1">
                        {selectedStudentName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStudentId('');
                          setSelectedStudentName('');
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <StudentSearchDropdown
                      onSelect={(s) => {
                        setStudentId(s.id);
                        setSelectedStudentName(s.name);
                      }}
                      selectedStudentId={studentId}
                      activeOnly={true}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Guest Name</label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter Guest Name"
                  />
                </div>
              )}
              <div className="pt-4 border-t flex items-center justify-between">
                <div className="text-sm">
                  <div className="text-muted-foreground">Estimated Cost</div>
                  <div className="text-2xl font-bold text-primary">
                    ₱{totalCost.toFixed(2)}
                  </div>
                </div>
                <Button
                  onClick={createJob}
                  disabled={totalCost === 0}
                  className="w-32"
                >
                  <Plus className="h-4 w-4 mr-2" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Reset Print Job History?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                This will permanently delete all print job records.
                <br />
                <strong className="text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </strong>
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={resetJobs}
                  disabled={resetting}
                >
                  {resetting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Jobs History */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Print Job History
              </CardTitle>
              <CardDescription>Recent printing transactions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No print jobs recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((j) => (
                      <TableRow key={j.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(j.created_at).toLocaleDateString()}
                          <br />
                          {new Date(j.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {j.student
                                ? `${j.student.first_name} ${j.student.last_name}`
                                : j.guest_name || 'Guest'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {j.student ? j.student.student_id : 'Guest User'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {j.paper_size}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {j.color_level}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{j.pages}</TableCell>
                        <TableCell className="text-right font-medium">
                          ₱{j.total_cost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={j.paid ? 'default' : 'destructive'}>
                            {j.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!j.paid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markPaid(j.id)}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Price Settings Tab */}
      <TabsContent value="settings" className="space-y-6">
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Price Configuration
            </CardTitle>
            <CardDescription>
              Manage printing prices for different paper sizes and colors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Pricing Table */}
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Paper Size</TableHead>
                    <TableHead>Color Type</TableHead>
                    <TableHead className="text-right">Price (₱)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No pricing configured. Add your first price below.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pricing.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {PAPER_SIZE_LABELS[p.paper_size] || p.paper_size}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {COLOR_LEVEL_LABELS[p.color_level] || p.color_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingPriceId === p.id ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={editingPrice}
                              onChange={(e) =>
                                setEditingPrice(parseFloat(e.target.value) || 0)
                              }
                              className="w-24 ml-auto"
                            />
                          ) : (
                            <span className="font-bold">
                              ₱{p.price.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {editingPriceId === p.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updatePrice(p.id, editingPrice)
                                  }
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingPriceId(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPriceId(p.id);
                                    setEditingPrice(p.price);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => deletePricing(p.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Add New Pricing */}
            <div className="pt-4 border-t">
              {!showAddPrice ? (
                <Button
                  onClick={() => setShowAddPrice(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Price
                </Button>
              ) : (
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <h4 className="font-medium">Add New Price</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Paper Size</label>
                      <Select
                        value={newPriceEntry.paper_size}
                        onValueChange={(v) =>
                          setNewPriceEntry({ ...newPriceEntry, paper_size: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHORT">Short (Letter)</SelectItem>
                          <SelectItem value="LONG">Long (Legal)</SelectItem>
                          <SelectItem value="A4">A4</SelectItem>
                          <SelectItem value="CUSTOM">
                            + Add Custom Size
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {newPriceEntry.paper_size === 'CUSTOM' && (
                        <Input
                          placeholder="Enter custom size name"
                          value={newPriceEntry.customSize}
                          onChange={(e) =>
                            setNewPriceEntry({
                              ...newPriceEntry,
                              customSize: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Color Type</label>
                      <Select
                        value={newPriceEntry.color_level}
                        onValueChange={(v) =>
                          setNewPriceEntry({ ...newPriceEntry, color_level: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BW">Black & White</SelectItem>
                          <SelectItem value="HALF_COLOR">Half Color</SelectItem>
                          <SelectItem value="FULL_COLOR">Full Color</SelectItem>
                          <SelectItem value="CUSTOM">
                            + Add Custom Color
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {newPriceEntry.color_level === 'CUSTOM' && (
                        <Input
                          placeholder="Enter custom color name"
                          value={newPriceEntry.customColor}
                          onChange={(e) =>
                            setNewPriceEntry({
                              ...newPriceEntry,
                              customColor: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Price per Page (₱)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0.00"
                      value={newPriceEntry.price || ''}
                      onChange={(e) =>
                        setNewPriceEntry({
                          ...newPriceEntry,
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddPrice(false);
                        setNewPriceEntry({
                          paper_size: '',
                          color_level: '',
                          price: 0,
                          customSize: '',
                          customColor: '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={addPricing}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Price
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
