import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toUserMessage } from '@/utils/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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
  student_id: string;
  paper_size: PaperSize;
  color_level: ColorLevel;
  pages: number;
  price_per_page: number;
  total_cost: number;
  paid: boolean;
  receipt_no?: string;
}

export default function PrintingTracker() {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>('SHORT');
  const [colorLevel, setColorLevel] = useState<ColorLevel>('BW');
  const [pages, setPages] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [newPrice, setNewPrice] = useState<number>(0);

  const loadPricing = async () => {
    try {
      const res = await apiClient.get<Pricing[]>('/api/printing/pricing');
      if (res.success && res.data) {
        setPricing(res.data);
      } else {
        setPricing([]);
        if (!import.meta.env.DEV) toast.error(res.error || 'Failed to load pricing');
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
        if (!import.meta.env.DEV) toast.error(res.error || 'Failed to load jobs');
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
    const p = pricing.find((x) => x.paper_size === paperSize && x.color_level === colorLevel && x.is_active);
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
    if (!studentId || pages <= 0) {
      toast.warning('Student ID and pages required');
      return;
    }
    try {
      const res = await apiClient.post<Job>('/api/printing/jobs', {
        student_id: studentId,
        paper_size: paperSize,
        color_level: colorLevel,
        pages,
      });
      if (res.success && res.data) {
        toast.success('Job created');
        setStudentId('');
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
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, paid: true } : j)));
      } else {
        toast.error(res.error || 'Failed to mark job paid');
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Printing Service Tracker</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Paper" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHORT">Short</SelectItem>
                  <SelectItem value="LONG">Long</SelectItem>
                </SelectContent>
              </Select>
              <Select value={colorLevel} onValueChange={(v) => setColorLevel(v as ColorLevel)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BW">Black & White</SelectItem>
                  <SelectItem value="HALF_COLOR">Half Colored</SelectItem>
                  <SelectItem value="FULL_COLOR">Full Colored</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" value={pages} onChange={(e) => setPages(parseInt(e.target.value || '0', 10))} className="w-24" placeholder="Pages" />
            </div>
            <div className="flex gap-2">
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
              <Button onClick={createJob}>Create Job</Button>
            </div>
            <div className="text-sm">Price per page: {activePrice.toFixed(2)} • Total: {totalCost.toFixed(2)}</div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Input type="number" value={newPrice} onChange={(e) => setNewPrice(parseFloat(e.target.value || '0'))} placeholder="New price" />
              <Button variant="outline" onClick={createPricing}>Add Pricing</Button>
            </div>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paper</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.paper_size}</TableCell>
                      <TableCell>{p.color_level}</TableCell>
                      <TableCell>{p.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Paper</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.student_id}</TableCell>
                  <TableCell>{j.paper_size}</TableCell>
                  <TableCell>{j.color_level}</TableCell>
                  <TableCell>{j.pages}</TableCell>
                  <TableCell>{j.total_cost}</TableCell>
                  <TableCell>{j.paid ? 'Paid' : 'Unpaid'}</TableCell>
                  <TableCell>
                    {!j.paid && <Button size="sm" onClick={() => markPaid(j.id)}>Mark Paid</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}