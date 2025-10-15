import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Database,
  Eye,
  Activity,
  TrendingUp,
  Download,
  RefreshCw,
  Settings,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';

// Types for security data
interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  status: 'active' | 'resolved' | 'investigating';
  ipAddress: string;
  userId?: string;
  userRole?: string;
  actions: Array<{
    label: string;
    action: string;
  }>;
}

interface SecurityMetrics {
  totalEvents: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  resolvedToday: number;
  activeThreats: number;
  blockedAttempts: number;
  dataAccessRequests: number;
  complianceScore: number;
  encryptionStatus: 'healthy' | 'warning' | 'critical';
  auditLogStatus: 'healthy' | 'warning' | 'critical';
}

interface FERPAComplianceData {
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  deniedRequests: number;
  expiredRequests: number;
  complianceLevel: number;
  violations: number;
  lastAuditDate: string;
  nextAuditDate: string;
  dataRetentionStatus: 'compliant' | 'warning' | 'violation';
}

interface AccessPattern {
  userId: string;
  userRole: string;
  accessCount: number;
  lastAccess: string;
  unusualPattern: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [ferpaData, setFerpaData] = useState<FERPAComplianceData | null>(null);
  const [accessPatterns, setAccessPatterns] = useState<AccessPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Fetch security data
  const fetchSecurityData = async () => {
    try {
      setLoading(true);

      // In a real implementation, these would be API calls
      // For now, we'll use mock data that demonstrates the structure

      const mockMetrics: SecurityMetrics = {
        totalEvents: 1247,
        criticalAlerts: 2,
        highAlerts: 8,
        mediumAlerts: 23,
        lowAlerts: 45,
        resolvedToday: 31,
        activeThreats: 5,
        blockedAttempts: 127,
        dataAccessRequests: 18,
        complianceScore: 94,
        encryptionStatus: 'healthy',
        auditLogStatus: 'healthy'
      };

      const mockAlerts: SecurityAlert[] = [
        {
          id: '1',
          type: 'FERPA_VIOLATION',
          severity: 'critical',
          title: 'Unauthorized FERPA Data Access',
          description: 'User attempted to access sensitive student data without proper justification',
          timestamp: '2024-01-15T14:30:00Z',
          status: 'active',
          ipAddress: '192.168.1.100',
          userId: 'user_123',
          userRole: 'TEACHER',
          actions: [
            { label: 'Investigate', action: 'investigate' },
            { label: 'Block User', action: 'block' },
            { label: 'Create Incident', action: 'incident' }
          ]
        },
        {
          id: '2',
          type: 'SUSPICIOUS_PATTERN',
          severity: 'high',
          title: 'Unusual Data Access Pattern',
          description: 'User accessed 50+ student records in 10 minutes',
          timestamp: '2024-01-15T13:45:00Z',
          status: 'investigating',
          ipAddress: '192.168.1.101',
          userId: 'user_456',
          userRole: 'LIBRARIAN',
          actions: [
            { label: 'View Details', action: 'details' },
            { label: 'Contact User', action: 'contact' }
          ]
        }
      ];

      const mockFERPAData: FERPAComplianceData = {
        totalRequests: 156,
        approvedRequests: 124,
        pendingRequests: 18,
        deniedRequests: 8,
        expiredRequests: 6,
        complianceLevel: 94,
        violations: 2,
        lastAuditDate: '2024-01-10T00:00:00Z',
        nextAuditDate: '2024-01-17T00:00:00Z',
        dataRetentionStatus: 'compliant'
      };

      const mockAccessPatterns: AccessPattern[] = [
        {
          userId: 'user_123',
          userRole: 'TEACHER',
          accessCount: 47,
          lastAccess: '2024-01-15T14:30:00Z',
          unusualPattern: true,
          riskLevel: 'high'
        },
        {
          userId: 'user_456',
          userRole: 'LIBRARIAN',
          accessCount: 23,
          lastAccess: '2024-01-15T13:45:00Z',
          unusualPattern: false,
          riskLevel: 'medium'
        }
      ];

      setMetrics(mockMetrics);
      setAlerts(mockAlerts);
      setFerpaData(mockFERPAData);
      setAccessPatterns(mockAccessPatterns);

    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();

    if (autoRefresh) {
      const interval = setInterval(fetchSecurityData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedTimeRange]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'investigating': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHealthIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring and FERPA compliance overview
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchSecurityData}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>

          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {alerts.filter(alert => alert.severity === 'critical' && alert.status === 'active').length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-700">Critical Security Alert</AlertTitle>
          <AlertDescription className="text-red-600">
            {alerts.filter(alert => alert.severity === 'critical' && alert.status === 'active').length} critical alert(s) require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics?.activeThreats}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics?.complianceScore}%</div>
            <Progress value={metrics?.complianceScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Attempts</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blockedAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Successfully blocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="ferpa">FERPA Compliance</TabsTrigger>
          <TabsTrigger value="patterns">Access Patterns</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        {/* Security Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Recent Security Alerts
              </CardTitle>
              <CardDescription>
                Real-time security events and threats requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(alert.status)}
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{alert.title}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {alert.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>IP: {alert.ipAddress}</span>
                        {alert.userId && (
                          <span>User: {alert.userId} ({alert.userRole})</span>
                        )}
                        <span>Type: {alert.type}</span>
                      </div>

                      {alert.actions.length > 0 && (
                        <div className="flex gap-2 pt-2">
                          {alert.actions.map((action, index) => (
                            <Button key={index} variant="outline" size="sm">
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FERPA Compliance Tab */}
        <TabsContent value="ferpa" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Access Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Requests</span>
                  <span className="font-medium">{ferpaData?.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Approved</span>
                  <span className="font-medium text-green-600">{ferpaData?.approvedRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="font-medium text-yellow-600">{ferpaData?.pendingRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Denied</span>
                  <span className="font-medium text-red-600">{ferpaData?.deniedRequests}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Compliance Level</span>
                  <span className="font-medium">{ferpaData?.complianceLevel}%</span>
                </div>
                <Progress value={ferpaData?.complianceLevel} className="mt-2" />
                <div className="flex justify-between">
                  <span className="text-sm">Violations</span>
                  <span className="font-medium text-red-600">{ferpaData?.violations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Last Audit</span>
                  <span className="text-sm">{new Date(ferpaData?.lastAuditDate || '').toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data Retention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  {getHealthIcon(ferpaData?.dataRetentionStatus || 'healthy')}
                  <span className="text-sm capitalize">{ferpaData?.dataRetentionStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Next Audit</span>
                  <span className="text-sm">{new Date(ferpaData?.nextAuditDate || '').toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                FERPA Encryption Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {getHealthIcon(metrics?.encryptionStatus || 'healthy')}
                  <span className="font-medium">Field Encryption</span>
                  <Badge variant={metrics?.encryptionStatus === 'healthy' ? 'default' : 'destructive'}>
                    {metrics?.encryptionStatus?.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {getHealthIcon(metrics?.auditLogStatus || 'healthy')}
                  <span className="font-medium">Audit Logs</span>
                  <Badge variant={metrics?.auditLogStatus === 'healthy' ? 'default' : 'destructive'}>
                    {metrics?.auditLogStatus?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Access Patterns
              </CardTitle>
              <CardDescription>
                Monitor unusual access patterns and potential security risks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Access Count</TableHead>
                    <TableHead>Last Access</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessPatterns.map((pattern, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{pattern.userId}</TableCell>
                      <TableCell>{pattern.userRole}</TableCell>
                      <TableCell>{pattern.accessCount}</TableCell>
                      <TableCell>{new Date(pattern.lastAccess).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          pattern.riskLevel === 'high' ? 'destructive' :
                          pattern.riskLevel === 'medium' ? 'default' : 'secondary'
                        }>
                          {pattern.riskLevel.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pattern.unusualPattern ? (
                          <Badge variant="outline" className="text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Unusual
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Normal
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Security Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Authentication Service</span>
                  {getHealthIcon('healthy')}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rate Limiting</span>
                  {getHealthIcon('healthy')}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Field Encryption</span>
                  {getHealthIcon(metrics?.encryptionStatus || 'healthy')}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audit Logging</span>
                  {getHealthIcon(metrics?.auditLogStatus || 'healthy')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Response Time</span>
                  <span className="font-medium">124ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Throughput</span>
                  <span className="font-medium">1,247 req/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Error Rate</span>
                  <span className="font-medium text-green-600">0.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Uptime</span>
                  <span className="font-medium text-green-600">99.9%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;