import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { useAuth } from '@/contexts/AuthContext';
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
  DollarSign,
  FileText,
  User,
  Users,
} from 'lucide-react';

type PaperSize = 'SHORT' | 'LONG';
type ColorLevel = 'BW' | 'HALF_COLOR' | 'FULL_COLOR';

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
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>('SHORT');
  const [colorLevel, setColorLevel] = useState<ColorLevel>('BW');
  const [pages, setPages] = useState(1);

  const [userType, setUserType] = useState<'STUDENT' | 'GUEST'>('STUDENT');
  const [studentId, setStudentId] = useState('');
  const [guestName, setGuestName] = useState('');

  const [newPrice, setNewPrice] = useState<number>(0);

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

  const createPricing = async () => {
    const priceVal = Number(newPrice);
    if (!isFinite(priceVal) || priceVal <= 0) {
      toast.warning('Enter price');
      return;
    }
    try {
      const res = await apiClient.post<Pricing>('/api/printing/pricing', {
        paper_size: paperSize,
        color_level: colorLevel,
        price: priceVal,
      });
      if (res.success) {
        toast.success('Pricing added');
        setNewPrice(0);
        loadPricing();
      } else {
        toast.error(res.error || 'Failed to add pricing');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  const createJob = async () => {
    if (userType === 'STUDENT' && !studentId) {
      toast.warning('Student ID required');
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
        student_id: userType === 'STUDENT' ? studentId : undefined,
        guest_name: userType === 'GUEST' ? guestName : undefined,
        paper_size: paperSize,
        color_level: colorLevel,
        pages,
      });
      if (res.success && res.data) {
        toast.success('Job created');
        setStudentId('');
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
    } catch (e) {
      toast.error('Failed to download report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* New Job Card */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              New Print Job
            </CardTitle>
            <CardDescription>Record a new printing transaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Paper Size</label>
                <Select
                  value={paperSize}
                  onValueChange={(v) => setPaperSize(v as PaperSize)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT">Short (Letter)</SelectItem>
                    <SelectItem value="LONG">Long (Legal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <Select
                  value={colorLevel}
                  onValueChange={(v) => setColorLevel(v as ColorLevel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BW">Black & White</SelectItem>
                    <SelectItem value="HALF_COLOR">Half Color</SelectItem>
                    <SelectItem value="FULL_COLOR">Full Color</SelectItem>
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
                onChange={(e) => setPages(parseInt(e.target.value || '0', 10))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User Type</label>
              <div className="flex gap-2">
                <Button
                  variant={userType === 'STUDENT' ? 'default' : 'outline'}
                  onClick={() => setUserType('STUDENT')}
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" /> Student
                </Button>
                <Button
                  variant={userType === 'GUEST' ? 'default' : 'outline'}
                  onClick={() => setUserType('GUEST')}
                  className="flex-1"
                >
                  <Users className="h-4 w-4 mr-2" /> Guest
                </Button>
              </div>
            </div>

            {userType === 'STUDENT' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Student ID</label>
                <Input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter Student ID"
                />
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

        {/* Pricing Card */}
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Pricing Configuration
            </CardTitle>
            <CardDescription>Manage printing costs per page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">New Price</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                />
              </div>
              <Button onClick={createPricing}>Update Price</Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.paper_size}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.color_level}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ₱{p.price.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <Button variant="outline" size="sm" onClick={downloadReport}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
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
    </div>
  );
}
