import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface FineCheckout {
  id: string;
  due_date: string;
  fine_amount: number;
  status: string;
  student?: {
    student_id: string;
    first_name: string;
    last_name: string;
    grade_level: number;
  };
  book?: { title: string; accession_no: string };
}

export default function FineManagement() {
  const [items, setItems] = useState<FineCheckout[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOverdue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<FineCheckout[]>('/api/fines/overdue');
      if (res.success && res.data) setItems(res.data);
    } catch {
      toast.error('Failed to load overdue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverdue();
  }, []);

  const calculateFine = async (id: string) => {
    try {
      const res = await apiClient.post<{ fine_amount: number }>(
        `/api/fines/calculate/${id}`
      );
      if (res.success && res.data) {
        toast.success('Fine calculated');
        setItems((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, fine_amount: res.data.fine_amount } : c
          )
        );
      }
    } catch {
      toast.error('Failed to calculate fine');
    }
  };

  const markPaid = async (id: string) => {
    try {
      const res = await apiClient.post(`/api/fines/mark-paid/${id}`);
      if (res.success) {
        toast.success('Marked as paid');
        setItems((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      toast.error('Failed to mark paid');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fines & Overdue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Book</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Fine</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading...</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No overdue items</TableCell>
                </TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {`${c.student?.first_name || ''} ${c.student?.last_name || ''}`.trim()}
                    </TableCell>
                    <TableCell>{c.book?.title || ''}</TableCell>
                    <TableCell>
                      {new Date(c.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{c.fine_amount || 0}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" onClick={() => calculateFine(c.id)}>
                        Calculate
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => markPaid(c.id)}
                      >
                        Mark Paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
