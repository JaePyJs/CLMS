import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Policy {
  id: string;
  name?: string;
  category: string;
  loan_days: number;
  overnight: boolean;
  is_active: boolean;
}

export default function BorrowingPolicyManager() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [category, setCategory] = useState('');
  const [loanDays, setLoanDays] = useState<number>(3);
  const [overnight, setOvernight] = useState(false);

  const loadPolicies = async () => {
    try {
      const res = await apiClient.get<Policy[]>('/api/policies');
      if (res.success && res.data) setPolicies(res.data);
    } catch {
      toast.error('Failed to load policies');
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const createPolicy = async () => {
    if (!category || (!overnight && !loanDays)) {
      toast.warning('Category and either loan days or overnight');
      return;
    }
    try {
      const res = await apiClient.post<Policy>('/api/policies', { category, loan_days: loanDays, overnight });
      if (res.success) {
        toast.success('Policy created');
        setCategory('');
        setLoanDays(3);
        setOvernight(false);
        loadPolicies();
      }
    } catch {
      toast.error('Failed to create policy');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await apiClient.put(`/api/policies/${id}`, { is_active: !current });
      if (res.success) {
        setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p)));
      }
    } catch {
      toast.error('Failed to update policy');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Borrowing Policies</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input type="number" placeholder="Loan Days" value={loanDays} onChange={(e) => setLoanDays(parseInt(e.target.value || '0', 10))} />
          <div className="flex items-center gap-2">
            <Checkbox checked={overnight} onCheckedChange={(v) => setOvernight(Boolean(v))} />
            <span>Overnight</span>
          </div>
          <Button onClick={createPolicy}>Add</Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Loan Days</TableHead>
                <TableHead>Overnight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No policies</TableCell>
                </TableRow>
              ) : (
                policies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{p.loan_days}</TableCell>
                    <TableCell>{p.overnight ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{p.is_active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => toggleActive(p.id, p.is_active)}>{p.is_active ? 'Disable' : 'Enable'}</Button>
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