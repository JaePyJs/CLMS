import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Download,
  Filter,
  Search,
  Eye,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  FileText,
  RefreshCw,
  ChevronDown,
  User,
  MapPin,
  Activity,
  Settings,
  Export
} from 'lucide-react';

// Types
interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  sessionId?: string;
  requestId?: string;
  endpoint: string;
  method: string;
  ipAddress: string;
  userAgent?: string;
  entityType: string;
  entityId?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'SEARCH';
  fieldsAccessed: string[];
  sensitiveFieldsAccessed: string[];
  encryptedFieldsAccessed: string[];
  dataAccessLevel: 'PUBLIC' | 'LIMITED' | 'SENSITIVE' | 'RESTRICTED' | 'CONFIDENTIAL';
  recordsAffected: number;
  dataSize: number;
  responseStatus: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  duration: number;
  ferpaCompliance: {
    required: boolean;
    verified: boolean;
    accessRequestId?: string;
    justificationProvided: boolean;
  };
  securityFlags: {
    suspiciousActivity: boolean;
    unusualAccessPattern: boolean;
    dataExfiltrationRisk: boolean;
    privilegeEscalationAttempt: boolean;
    bruteForceIndicator: boolean;
  };
  metadata: {
    requestSize: number;
    responseSize: number;
    cacheHit: boolean;
    databaseQueryCount: number;
    apiRate: number;
  };
}

interface FilterOptions {
  dateRange: '1h' | '24h' | '7d' | '30d' | 'custom';
  startDate?: string;
  endDate?: string;
  userId?: string;
  userRole?: string;
  entityType?: string;
  action?: string;
  success?: boolean;
  dataAccessLevel?: string;
  hasSecurityFlags?: boolean;
  ferpaRequired?: boolean;
  endpoint?: string;
  ipAddress?: string;
  minRecordsAffected?: number;
  maxRecordsAffected?: number;
  minDuration?: number;
  maxDuration?: number;
}

const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '24h'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const logsPerPage = 50;

  // Fetch audit logs
  const fetchAuditLogs = async (page: number = 1) => {
    try {
      setLoading(true);

      // Mock API call - in real app, this would be an actual API call
      const mockLogs: AuditLogEntry[] = Array.from({ length: 150 }, (_, index) => ({
        id: `audit_${Date.now()}_${index}`,
        timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        userId: `user_${Math.floor(Math.random() * 100)}`,
        userRole: ['TEACHER', 'LIBRARIAN', 'ADMIN', 'STAFF'][Math.floor(Math.random() * 4)] as any,
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
        requestId: `req_${Math.random().toString(36).substr(2, 9)}`,
        endpoint: ['/api/students', '/api/activities', '/api/books', '/api/equipment'][Math.floor(Math.random() * 4)],
        method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)] as any,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        entityType: ['student', 'activity', 'book', 'equipment'][Math.floor(Math.random() * 4)],
        entityId: `entity_${Math.floor(Math.random() * 1000)}`,
        action: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'SEARCH'][Math.floor(Math.random() * 6)] as any,
        fieldsAccessed: ['name', 'email', 'grade', 'section'].slice(0, Math.floor(Math.random() * 4) + 1),
        sensitiveFieldsAccessed: Math.random() > 0.7 ? ['email', 'phone'] : [],
        encryptedFieldsAccessed: Math.random() > 0.8 ? ['ssn', 'medical_info'] : [],
        dataAccessLevel: ['PUBLIC', 'LIMITED', 'SENSITIVE', 'RESTRICTED', 'CONFIDENTIAL'][Math.floor(Math.random() * 5)] as any,
        recordsAffected: Math.floor(Math.random() * 100),
        dataSize: Math.floor(Math.random() * 10000),
        responseStatus: Math.random() > 0.1 ? 200 : [400, 401, 403, 404, 500][Math.floor(Math.random() * 5)],
        success: Math.random() > 0.1,
        duration: Math.floor(Math.random() * 1000) + 10,
        ferpaCompliance: {
          required: Math.random() > 0.5,
          verified: Math.random() > 0.3,
          accessRequestId: Math.random() > 0.7 ? `req_${Math.random().toString(36).substr(2, 9)}` : undefined,
          justificationProvided: Math.random() > 0.4
        },
        securityFlags: {
          suspiciousActivity: Math.random() > 0.9,
          unusualAccessPattern: Math.random() > 0.85,
          dataExfiltrationRisk: Math.random() > 0.95,
          privilegeEscalationAttempt: Math.random() > 0.98,
          bruteForceIndicator: Math.random() > 0.95
        },
        metadata: {
          requestSize: Math.floor(Math.random() * 1000),
          responseSize: Math.floor(Math.random() * 5000),
          cacheHit: Math.random() > 0.5,
          databaseQueryCount: Math.floor(Math.random() * 10) + 1,
          apiRate: Math.floor(Math.random() * 100)
        }
      }));

      // Apply filters
      let filteredLogs = mockLogs.filter(log => {
        // Date range filter
        const logDate = new Date(log.timestamp);
        const now = new Date();

        if (filters.dateRange === '1h') {
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (logDate < oneHourAgo) return false;
        } else if (filters.dateRange === '24h') {
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          if (logDate < oneDayAgo) return false;
        } else if (filters.dateRange === '7d') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < oneWeekAgo) return false;
        } else if (filters.dateRange === '30d') {
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < oneMonthAgo) return false;
        }

        // Search filter
        if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        // Other filters
        if (filters.userId && log.userId !== filters.userId) return false;
        if (filters.userRole && log.userRole !== filters.userRole) return false;
        if (filters.entityType && log.entityType !== filters.entityType) return false;
        if (filters.action && log.action !== filters.action) return false;
        if (filters.success !== undefined && log.success !== filters.success) return false;
        if (filters.dataAccessLevel && log.dataAccessLevel !== filters.dataAccessLevel) return false;
        if (filters.hasSecurityFlags && !Object.values(log.securityFlags).some(Boolean)) return false;
        if (filters.ferpaRequired !== undefined && log.ferpaCompliance.required !== filters.ferpaRequired) return false;

        return true;
      });

      // Pagination
      const startIndex = (page - 1) * logsPerPage;
      const endIndex = startIndex + logsPerPage;
      const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

      setLogs(paginatedLogs);
      setTotalPages(Math.ceil(filteredLogs.length / logsPerPage));
      setCurrentPage(page);

    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(currentPage);
  }, [currentPage, filters, searchTerm]);

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      setExporting(true);

      // Mock export functionality
      const exportData = logs.map(log => ({
        timestamp: log.timestamp,
        userId: log.userId,
        userRole: log.userRole,
        endpoint: log.endpoint,
        method: log.method,
        action: log.action,
        entityType: log.entityType,
        recordsAffected: log.recordsAffected,
        success: log.success,
        dataAccessLevel: log.dataAccessLevel,
        hasSecurityFlags: Object.values(log.securityFlags).some(Boolean),
        ferpaRequired: log.ferpaCompliance.required
      }));

      // In a real app, this would trigger an actual download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Audit logs exported as ${format.toUpperCase()}`);

    } catch (error) {
      console.error('Failed to export logs:', error);
      alert('Failed to export logs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'READ': return <Eye className="h-4 w-4 text-blue-500" />;
      case 'UPDATE': return <RefreshCw className="h-4 w-4 text-yellow-500" />;
      case 'DELETE': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'EXPORT': return <Download className="h-4 w-4 text-purple-500" />;
      case 'SEARCH': return <Search className="h-4 w-4 text-gray-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'PUBLIC': return 'bg-green-100 text-green-800';
      case 'LIMITED': return 'bg-blue-100 text-blue-800';
      case 'SENSITIVE': return 'bg-yellow-100 text-yellow-800';
      case 'RESTRICTED': return 'bg-orange-100 text-orange-800';
      case 'CONFIDENTIAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const hasSecurityFlags = (log: AuditLogEntry) => {
    return Object.values(log.securityFlags).some(Boolean);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading audit logs...</span>
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
            Audit Log Viewer
          </h1>
          <p className="text-muted-foreground">
            Comprehensive audit trail for all system access and data operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAuditLogs(currentPage)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={filters.dateRange}
            onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>User Role</Label>
                  <Select
                    value={filters.userRole || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, userRole: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Roles</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={filters.entityType || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Entities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Entities</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="activity">Activity</SelectItem>
                      <SelectItem value="book">Book</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={filters.action || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, action: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Actions</SelectItem>
                      <SelectItem value="READ">Read</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="EXPORT">Export</SelectItem>
                      <SelectItem value="SEARCH">Search</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Access Level</Label>
                  <Select
                    value={filters.dataAccessLevel || ''}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, dataAccessLevel: value || undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Levels</SelectItem>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="LIMITED">Limited</SelectItem>
                      <SelectItem value="SENSITIVE">Sensitive</SelectItem>
                      <SelectItem value="RESTRICTED">Restricted</SelectItem>
                      <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Success Status</Label>
                  <Select
                    value={filters.success !== undefined ? (filters.success ? 'true' : 'false') : ''}
                    onValueChange={(value) => setFilters(prev => ({
                      ...prev,
                      success: value ? value === 'true' : undefined
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="true">Success</SelectItem>
                      <SelectItem value="false">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Security Flags</Label>
                  <div className="space-y-2">
                    <Checkbox
                      checked={filters.hasSecurityFlags || false}
                      onCheckedChange={(checked) => setFilters(prev => ({
                        ...prev,
                        hasSecurityFlags: checked || undefined
                      }))}
                    >
                      Has Security Flags
                    </Checkbox>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>FERPA Required</Label>
                  <Select
                    value={filters.ferpaRequired !== undefined ? (filters.ferpaRequired ? 'true' : 'false') : ''}
                    onValueChange={(value) => setFilters(prev => ({
                      ...prev,
                      ferpaRequired: value ? value === 'true' : undefined
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="true">Required</SelectItem>
                      <SelectItem value="false">Not Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setFilters({ dateRange: '24h' })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Audit Logs ({logs.length} entries)
            </span>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Data Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>FERPA</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.userId}</p>
                        <p className="text-sm text-muted-foreground">{log.userRole}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="capitalize">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="capitalize">{log.entityType}</p>
                        <p className="text-muted-foreground">{log.endpoint}</p>
                      </div>
                    </TableCell>
                    <TableCell>{log.recordsAffected}</TableCell>
                    <TableCell>
                      <Badge className={getAccessLevelColor(log.dataAccessLevel)}>
                        {log.dataAccessLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">{log.responseStatus}</span>
                      </div>
                    </TableCell>
                    <TableCell>{log.duration}ms</TableCell>
                    <TableCell>
                      {hasSecurityFlags(log) && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Flags
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.ferpaCompliance.required && (
                        <div className="flex items-center gap-1">
                          <Shield className={`h-4 w-4 ${log.ferpaCompliance.verified ? 'text-green-500' : 'text-yellow-500'}`} />
                          <span className="text-xs">
                            {log.ferpaCompliance.verified ? 'OK' : 'Required'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {logs.length} of {logs.length} entries
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log Details
              </DialogTitle>
              <DialogDescription>
                Detailed information about the selected audit event
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Log ID</Label>
                    <p className="font-mono text-sm">{selectedLog.id}</p>
                  </div>
                  <div>
                    <Label>Timestamp</Label>
                    <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label>User</Label>
                    <p>{selectedLog.userId} ({selectedLog.userRole})</p>
                  </div>
                  <div>
                    <Label>Session ID</Label>
                    <p className="font-mono text-sm">{selectedLog.sessionId}</p>
                  </div>
                  <div>
                    <Label>Request ID</Label>
                    <p className="font-mono text-sm">{selectedLog.requestId}</p>
                  </div>
                  <div>
                    <Label>IP Address</Label>
                    <p>{selectedLog.ipAddress}</p>
                  </div>
                </div>

                {/* Request Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Request Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Endpoint</Label>
                      <p>{selectedLog.endpoint}</p>
                    </div>
                    <div>
                      <Label>Method</Label>
                      <p>{selectedLog.method}</p>
                    </div>
                    <div>
                      <Label>Action</Label>
                      <p className="capitalize">{selectedLog.action}</p>
                    </div>
                    <div>
                      <Label>Entity</Label>
                      <p className="capitalize">{selectedLog.entityType} ({selectedLog.entityId})</p>
                    </div>
                  </div>
                </div>

                {/* Data Access Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Data Access Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Fields Accessed</Label>
                      <p className="text-sm">{selectedLog.fieldsAccessed.join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <Label>Sensitive Fields</Label>
                      <p className="text-sm text-red-600">
                        {selectedLog.sensitiveFieldsAccessed.join(', ') || 'None'}
                      </p>
                    </div>
                    <div>
                      <Label>Encrypted Fields</Label>
                      <p className="text-sm text-blue-600">
                        {selectedLog.encryptedFieldsAccessed.join(', ') || 'None'}
                      </p>
                    </div>
                    <div>
                      <Label>Data Access Level</Label>
                      <Badge className={getAccessLevelColor(selectedLog.dataAccessLevel)}>
                        {selectedLog.dataAccessLevel}
                      </Badge>
                    </div>
                    <div>
                      <Label>Records Affected</Label>
                      <p>{selectedLog.recordsAffected}</p>
                    </div>
                    <div>
                      <Label>Data Size</Label>
                      <p>{(selectedLog.dataSize / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                </div>

                {/* Response Information */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Response Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <div className="flex items-center gap-2">
                        {selectedLog.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{selectedLog.responseStatus}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Duration</Label>
                      <p>{selectedLog.duration}ms</p>
                    </div>
                    {selectedLog.errorMessage && (
                      <div className="col-span-2">
                        <Label>Error Message</Label>
                        <p className="text-sm text-red-600">{selectedLog.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* FERPA Compliance */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">FERPA Compliance</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>FERPA Required</Label>
                      <p>{selectedLog.ferpaCompliance.required ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label>FERPA Verified</Label>
                      <p>{selectedLog.ferpaCompliance.verified ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label>Justification Provided</Label>
                      <p>{selectedLog.ferpaCompliance.justificationProvided ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label>Access Request ID</Label>
                      <p className="font-mono text-sm">{selectedLog.ferpaCompliance.accessRequestId || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Security Flags */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Security Flags</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${selectedLog.securityFlags.suspiciousActivity ? 'text-red-500' : 'text-gray-400'}`} />
                      <Label>Suspicious Activity</Label>
                      <span>{selectedLog.securityFlags.suspiciousActivity ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${selectedLog.securityFlags.unusualAccessPattern ? 'text-orange-500' : 'text-gray-400'}`} />
                      <Label>Unusual Access Pattern</Label>
                      <span>{selectedLog.securityFlags.unusualAccessPattern ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${selectedLog.securityFlags.dataExfiltrationRisk ? 'text-red-500' : 'text-gray-400'}`} />
                      <Label>Data Exfiltration Risk</Label>
                      <span>{selectedLog.securityFlags.dataExfiltrationRisk ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${selectedLog.securityFlags.privilegeEscalationAttempt ? 'text-red-500' : 'text-gray-400'}`} />
                      <Label>Privilege Escalation Attempt</Label>
                      <span>{selectedLog.securityFlags.privilegeEscalationAttempt ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Request Size</Label>
                      <p>{selectedLog.metadata.requestSize} bytes</p>
                    </div>
                    <div>
                      <Label>Response Size</Label>
                      <p>{selectedLog.metadata.responseSize} bytes</p>
                    </div>
                    <div>
                      <Label>Cache Hit</Label>
                      <p>{selectedLog.metadata.cacheHit ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label>Database Queries</Label>
                      <p>{selectedLog.metadata.databaseQueryCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AuditLogViewer;