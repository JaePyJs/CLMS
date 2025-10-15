import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Send,
  Eye,
  Users,
  Shield,
  Calendar,
  Info,
  Loader2
} from 'lucide-react';

// Types
interface AccessRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  targetType: 'student' | 'students' | 'activity' | 'activities';
  targetId?: string;
  targetDescription?: string;
  accessType: 'VIEW' | 'EDIT' | 'EXPORT' | 'PRINT' | 'SHARE' | 'ANALYTICS';
  justification: 'EDUCATIONAL_PURPOSE' | 'LEGAL_REQUIREMENT' | 'HEALTH_SAFETY' | 'CONSENT' | 'DIRECTORY_INFO' | 'ADMINISTRATIVE' | 'RESEARCH' | 'AUDIT';
  justificationText: string;
  duration: number;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  metadata: {
    ipAddress: string;
    userAgent: string;
  };
}

interface NewAccessRequest {
  targetType: 'student' | 'students' | 'activity' | 'activities';
  targetId?: string;
  accessType: 'VIEW' | 'EDIT' | 'EXPORT' | 'PRINT' | 'SHARE' | 'ANALYTICS';
  justification: 'EDUCATIONAL_PURPOSE' | 'LEGAL_REQUIREMENT' | 'HEALTH_SAFETY' | 'CONSENT' | 'DIRECTORY_INFO' | 'ADMINISTRATIVE' | 'RESEARCH' | 'AUDIT';
  justificationText: string;
  duration: number;
}

const AccessRequestManager: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('my-requests');
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [newRequest, setNewRequest] = useState<NewAccessRequest>({
    targetType: 'student',
    accessType: 'VIEW',
    justification: 'EDUCATIONAL_PURPOSE',
    justificationText: '',
    duration: 24
  });

  // Mock user data - in real app, this would come from auth context
  const currentUser = {
    id: 'user_123',
    name: 'John Teacher',
    role: 'TEACHER'
  };

  const isApprover = ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);

  // Fetch access requests
  const fetchAccessRequests = async () => {
    try {
      setLoading(true);

      // Mock API call - in real app, this would be an actual API call
      const mockRequests: AccessRequest[] = [
        {
          id: 'req_001',
          requesterId: 'user_123',
          requesterName: 'John Teacher',
          requesterRole: 'TEACHER',
          targetType: 'students',
          accessType: 'VIEW',
          justification: 'EDUCATIONAL_PURPOSE',
          justificationText: 'Need to access student grades for report card preparation',
          duration: 48,
          status: 'approved',
          createdAt: '2024-01-14T10:30:00Z',
          approvedBy: 'admin_001',
          approvedAt: '2024-01-14T11:15:00Z',
          expiresAt: '2024-01-16T10:30:00Z',
          metadata: {
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        },
        {
          id: 'req_002',
          requesterId: 'user_456',
          requesterName: 'Jane Librarian',
          requesterRole: 'LIBRARIAN',
          targetType: 'student',
          targetId: 'student_789',
          targetDescription: 'Student: Sarah Smith (Grade 10)',
          accessType: 'EXPORT',
          justification: 'ADMINISTRATIVE',
          justificationText: 'Export student contact information for library card renewal notices',
          duration: 8,
          status: 'pending',
          createdAt: '2024-01-15T09:15:00Z',
          metadata: {
            ipAddress: '192.168.1.101',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }
      ];

      // Filter requests based on user role and active tab
      let filteredRequests = mockRequests;

      if (activeTab === 'my-requests') {
        filteredRequests = mockRequests.filter(req => req.requesterId === currentUser.id);
      } else if (activeTab === 'pending-approval' && isApprover) {
        filteredRequests = mockRequests.filter(req => req.status === 'pending');
      }

      setRequests(filteredRequests);

    } catch (error) {
      console.error('Failed to fetch access requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessRequests();
  }, [activeTab]);

  const handleSubmitRequest = async () => {
    try {
      setSubmitting(true);

      // Validate form
      if (!newRequest.justificationText.trim()) {
        alert('Please provide a justification for your request');
        return;
      }

      // Mock API call - in real app, this would be an actual API call
      const newRequestData: AccessRequest = {
        id: `req_${Date.now()}`,
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterRole: currentUser.role,
        ...newRequest,
        status: 'pending',
        createdAt: new Date().toISOString(),
        metadata: {
          ipAddress: '192.168.1.100', // Would get from actual request
          userAgent: navigator.userAgent
        }
      };

      setRequests(prev => [newRequestData, ...prev]);
      setShowNewRequestDialog(false);
      setNewRequest({
        targetType: 'student',
        accessType: 'VIEW',
        justification: 'EDUCATIONAL_PURPOSE',
        justificationText: '',
        duration: 24
      });

      alert('Access request submitted successfully');

    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      // Mock API call
      setRequests(prev => prev.map(req =>
        req.id === requestId
          ? {
              ...req,
              status: 'approved' as const,
              approvedBy: currentUser.id,
              approvedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + (req.duration * 60 * 60 * 1000)).toISOString()
            }
          : req
      ));

      alert('Request approved successfully');

    } catch (error) {
      console.error('Failed to approve request:', error);
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      const reason = prompt('Please provide a reason for denying this request:');
      if (!reason) return;

      // Mock API call
      setRequests(prev => prev.map(req =>
        req.id === requestId
          ? { ...req, status: 'denied' as const }
          : req
      ));

      alert('Request denied successfully');

    } catch (error) {
      console.error('Failed to deny request:', error);
      alert('Failed to deny request. Please try again.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-gray-500" />;
      case 'revoked': return <XCircle className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getJustificationLabel = (justification: string) => {
    return justification.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading access requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Access Request Management
          </h1>
          <p className="text-muted-foreground">
            Manage FERPA compliance access requests and approvals
          </p>
        </div>

        <Button onClick={() => setShowNewRequestDialog(true)}>
          <Send className="h-4 w-4 mr-2" />
          New Access Request
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>FERPA Compliance Notice</AlertTitle>
        <AlertDescription>
          All access to sensitive student data requires proper justification and approval.
          Requests are logged and audited to ensure compliance with FERPA regulations.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>
          <TabsTrigger value="pending-approval" disabled={!isApprover}>
            Pending Approval
            {requests.filter(req => req.status === 'pending').length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {requests.filter(req => req.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          {isApprover && <TabsTrigger value="all-requests">All Requests</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                My Access Requests
              </CardTitle>
              <CardDescription>
                Track the status of your access requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessRequestTable
                requests={requests}
                currentUser={currentUser}
                isApprover={isApprover}
                onApprove={handleApproveRequest}
                onDeny={handleDenyRequest}
                onSelect={setSelectedRequest}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Approval
              </CardTitle>
              <CardDescription>
                Review and approve access requests from other users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessRequestTable
                requests={requests}
                currentUser={currentUser}
                isApprover={isApprover}
                onApprove={handleApproveRequest}
                onDeny={handleDenyRequest}
                onSelect={setSelectedRequest}
                showActions={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Access Requests
              </CardTitle>
              <CardDescription>
                View all access requests in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessRequestTable
                requests={requests}
                currentUser={currentUser}
                isApprover={isApprover}
                onApprove={handleApproveRequest}
                onDeny={handleDenyRequest}
                onSelect={setSelectedRequest}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Request Dialog */}
      <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Access Request</DialogTitle>
            <DialogDescription>
              Submit a request for access to sensitive data. All requests require proper justification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetType">Target Type</Label>
                <Select
                  value={newRequest.targetType}
                  onValueChange={(value: any) => setNewRequest(prev => ({ ...prev, targetType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Specific Student</SelectItem>
                    <SelectItem value="students">Multiple Students</SelectItem>
                    <SelectItem value="activity">Student Activity</SelectItem>
                    <SelectItem value="activities">Multiple Activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessType">Access Type</Label>
                <Select
                  value={newRequest.accessType}
                  onValueChange={(value: any) => setNewRequest(prev => ({ ...prev, accessType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEW">View Only</SelectItem>
                    <SelectItem value="EDIT">Edit/Modify</SelectItem>
                    <SelectItem value="EXPORT">Export Data</SelectItem>
                    <SelectItem value="PRINT">Print</SelectItem>
                    <SelectItem value="SHARE">Share</SelectItem>
                    <SelectItem value="ANALYTICS">Analytics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Justification Category</Label>
              <Select
                value={newRequest.justification}
                onValueChange={(value: any) => setNewRequest(prev => ({ ...prev, justification: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDUCATIONAL_PURPOSE">Educational Purpose</SelectItem>
                  <SelectItem value="LEGAL_REQUIREMENT">Legal Requirement</SelectItem>
                  <SelectItem value="HEALTH_SAFETY">Health & Safety</SelectItem>
                  <SelectItem value="CONSENT">With Consent</SelectItem>
                  <SelectItem value="DIRECTORY_INFO">Directory Information</SelectItem>
                  <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
                  <SelectItem value="RESEARCH">Research</SelectItem>
                  <SelectItem value="AUDIT">Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificationText">Detailed Justification</Label>
              <Textarea
                id="justificationText"
                placeholder="Please provide a detailed explanation of why you need this access..."
                value={newRequest.justificationText}
                onChange={(e) => setNewRequest(prev => ({ ...prev, justificationText: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="168"
                value={newRequest.duration}
                onChange={(e) => setNewRequest(prev => ({ ...prev, duration: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-sm text-muted-foreground">
                Maximum duration is 168 hours (7 days)
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getStatusIcon(selectedRequest.status)}
                Access Request Details
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Request ID</Label>
                    <p className="font-mono text-sm">{selectedRequest.id}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedRequest.status)}
                      <Badge className={getStatusColor(selectedRequest.status)}>
                        {selectedRequest.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Requester</Label>
                    <p>{selectedRequest.requesterName} ({selectedRequest.requesterRole})</p>
                  </div>
                  <div>
                    <Label>Created</Label>
                    <p>{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Target Type</Label>
                    <p className="capitalize">{selectedRequest.targetType}</p>
                  </div>
                  <div>
                    <Label>Access Type</Label>
                    <p className="capitalize">{selectedRequest.accessType}</p>
                  </div>
                </div>

                <div>
                  <Label>Justification</Label>
                  <p className="font-medium">{getJustificationLabel(selectedRequest.justification)}</p>
                </div>

                <div>
                  <Label>Detailed Justification</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedRequest.justificationText}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Duration</Label>
                    <p>{selectedRequest.duration} hours</p>
                  </div>
                  <div>
                    <Label>Expires</Label>
                    <p>
                      {selectedRequest.expiresAt
                        ? new Date(selectedRequest.expiresAt).toLocaleString()
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>

                {selectedRequest.approvedBy && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Approved By</Label>
                      <p>{selectedRequest.approvedBy}</p>
                    </div>
                    <div>
                      <Label>Approved At</Label>
                      <p>
                        {selectedRequest.approvedAt
                          ? new Date(selectedRequest.approvedAt).toLocaleString()
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Metadata</Label>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>IP Address: {selectedRequest.metadata.ipAddress}</p>
                    <p>User Agent: {selectedRequest.metadata.userAgent}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
              {isApprover && selectedRequest.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDenyRequest(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                  >
                    Deny
                  </Button>
                  <Button
                    onClick={() => {
                      handleApproveRequest(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Access Request Table Component
interface AccessRequestTableProps {
  requests: AccessRequest[];
  currentUser: any;
  isApprover: boolean;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onSelect: (request: AccessRequest) => void;
  showActions?: boolean;
}

const AccessRequestTable: React.FC<AccessRequestTableProps> = ({
  requests,
  currentUser,
  isApprover,
  onApprove,
  onDeny,
  onSelect,
  showActions = false
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-gray-500" />;
      case 'revoked': return <XCircle className="h-4 w-4 text-orange-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getJustificationLabel = (justification: string) => {
    return justification.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Request ID</TableHead>
          <TableHead>Requester</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Access Type</TableHead>
          <TableHead>Justification</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow key={request.id}>
            <TableCell className="font-mono text-sm">
              {request.id.substring(0, 12)}...
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{request.requesterName}</p>
                <p className="text-sm text-muted-foreground">{request.requesterRole}</p>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p className="capitalize">{request.targetType}</p>
                {request.targetDescription && (
                  <p className="text-sm text-muted-foreground">{request.targetDescription}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{request.accessType}</Badge>
            </TableCell>
            <TableCell>
              <div>
                <p className="text-sm">{getJustificationLabel(request.justification)}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {request.justificationText}
                </p>
              </div>
            </TableCell>
            <TableCell>{request.duration}h</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getStatusIcon(request.status)}
                <Badge className={getStatusColor(request.status)}>
                  {request.status.toUpperCase()}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              {new Date(request.createdAt).toLocaleDateString()}
            </TableCell>
            {showActions && request.status === 'pending' && (
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApprove(request.id)}
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDeny(request.id)}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            )}
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(request)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default AccessRequestManager;