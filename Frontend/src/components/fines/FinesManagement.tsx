import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  XCircle,
  Clock,
  BookOpen,
} from 'lucide-react';
import { finesApi } from '@/lib/api';
import { exportFinesToCSV } from '@/lib/export-utils';

interface Fine {
  id: string;
  studentId: string;
  studentName: string;
  bookId: string;
  bookTitle: string;
  checkoutId: string;
  checkoutDate: Date;
  dueDate: Date;
  returnDate: Date | null;
  overdueDays: number;
  fineAmount: number;
  finePaid: boolean;
  paidDate: Date | null;
  paidAmount: number | null;
  status: 'OUTSTANDING' | 'PAID' | 'WAIVED';
  createdAt: Date;
}

export default function FinesManagement() {
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedFine, setSelectedFine] = useState<Fine | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: null, text: '' });
    }, 5000);
  }, []);

  const fetchFines = useCallback(async () => {
    setLoading(true);
    try {
      const status =
        statusFilter === 'ALL'
          ? undefined
          : (statusFilter.toLowerCase() as 'outstanding' | 'paid');
      const response = await finesApi.getFines(status);

      if (response.success && response.data) {
        const data = response.data as Record<string, unknown>;
        setFines((data.fines as Fine[]) || []);
      } else {
        showMessage('error', 'Failed to load fines');
      }
    } catch (error) {
      console.error('Failed to fetch fines:', error);
      showMessage('error', 'Failed to load fines');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showMessage]);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const handleMarkAsPaid = (fine: Fine) => {
    setSelectedFine(fine);
    setPaymentAmount(fine.fineAmount.toString());
    setPaymentDialogOpen(true);
  };

  const processFinePayment = async () => {
    if (!selectedFine) {
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showMessage('error', 'Please enter a valid payment amount');
      return;
    }

    try {
      const response = await finesApi.recordPayment(selectedFine.checkoutId, {
        amountPaid: amount,
        paymentMethod: 'Cash',
        notes: 'Payment processed',
      });

      if (response.success) {
        showMessage('success', 'Payment recorded successfully');
        setPaymentDialogOpen(false);
        setSelectedFine(null);
        setPaymentAmount('');
        fetchFines();
      } else {
        showMessage('error', response.error || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      showMessage('error', 'Failed to process payment');
    }
  };

  const handleWaiveFine = async (checkoutId: string) => {
    const reason = prompt('Please enter reason for waiving this fine:');
    if (!reason) {
      return;
    }

    try {
      const response = await finesApi.waiveFine(checkoutId, reason);

      if (response.success) {
        showMessage('success', 'Fine waived successfully');
        fetchFines();
      } else {
        showMessage('error', response.error || 'Failed to waive fine');
      }
    } catch (error) {
      console.error('Failed to waive fine:', error);
      showMessage('error', 'Failed to waive fine');
    }
  };

  const exportFines = () => {
    try {
      exportFinesToCSV(filteredFines);
      showMessage('success', 'Fines exported successfully');
    } catch (error) {
      console.error('Failed to export fines:', error);
      showMessage('error', 'Failed to export fines');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OUTSTANDING':
        return (
          <Badge variant="destructive">
            <Clock className="w-3 h-3 mr-1" />
            Outstanding
          </Badge>
        );
      case 'PAID':
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'WAIVED':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Waived
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredFines = fines.filter(
    (fine) =>
      fine.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fine.bookTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOutstanding = fines
    .filter((f) => f.status === 'OUTSTANDING')
    .reduce((sum, f) => sum + f.fineAmount, 0);

  const totalCollected = fines
    .filter((f) => f.status === 'PAID')
    .reduce((sum, f) => sum + (f.paidAmount || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading fines...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message.type && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Outstanding
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalOutstanding)}
            </div>
            <p className="text-xs text-muted-foreground">
              {fines.filter((f) => f.status === 'OUTSTANDING').length} unpaid
              fines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Collected
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCollected)}
            </div>
            <p className="text-xs text-muted-foreground">
              {fines.filter((f) => f.status === 'PAID').length} paid fines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fines</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fines.length}</div>
            <p className="text-xs text-muted-foreground">All time records</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Fines Management
          </CardTitle>
          <CardDescription>Track and manage overdue book fines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {/* _Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student or book..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="OUTSTANDING">Outstanding</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="WAIVED">Waived</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button variant="outline" onClick={exportFines}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fines Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Overdue Days</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No fines found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFines.map((fine) => (
                    <TableRow key={fine.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{fine.studentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {fine.studentId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-[200px] truncate"
                          title={fine.bookTitle}
                        >
                          {fine.bookTitle}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(fine.dueDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{fine.overdueDays} days</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(fine.fineAmount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(fine.status)}</TableCell>
                      <TableCell className="text-right">
                        {fine.status === 'OUTSTANDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleMarkAsPaid(fine)}
                            >
                              Mark as Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWaiveFine(fine.id)}
                            >
                              Waive
                            </Button>
                          </div>
                        )}
                        {fine.status === 'PAID' && fine.paidDate && (
                          <span className="text-xs text-muted-foreground">
                            Paid: {formatDate(fine.paidDate)}
                          </span>
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

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Fine Payment</DialogTitle>
            <DialogDescription>
              Enter the payment amount for {selectedFine?.studentName}
            </DialogDescription>
          </DialogHeader>

          {selectedFine && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Book:</span>
                  <p className="font-medium">{selectedFine.bookTitle}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Overdue:</span>
                  <p className="font-medium">{selectedFine.overdueDays} days</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fine Amount:</span>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedFine.fineAmount)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="payment-amount" className="text-sm font-medium">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    ₱
                  </span>
                  <Input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={processFinePayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
