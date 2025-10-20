import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertCircle, XCircle, RefreshCw, FileText, GitBranch, Database, TestTube, Package } from 'lucide-react';
import { utilitiesApi } from '@/lib/api';
import { toast } from 'sonner';

interface DocumentationInfo {
  version: string;
  lastUpdated: string;
  lastCommitHash?: string;
  environment: string;
  features: {
    backend: {
      tests: number;
      apiEndpoints: number;
      services: number;
      databaseTables: number;
    };
    frontend: {
      tests: number;
      components: number;
      pages: number;
      assets: number;
    };
  };
  documentation: {
    claudeMd: {
      exists: boolean;
      lastModified: string;
    };
    readmeMd: {
      exists: boolean;
      lastModified: string;
    };
    apiDocs: {
      exists: boolean;
      lastModified: string;
    };
  };
  health: {
    status: 'healthy' | 'warning' | 'error';
    checks: {
      documentation: boolean;
      tests: boolean;
      builds: boolean;
    };
  };
}

interface HealthCheck {
  status: string;
  checks: Record<string, boolean>;
  lastChecked: string;
}

export function DocumentationDashboard() {
  const [docsInfo, setDocsInfo] = useState<DocumentationInfo | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDocumentationInfo = async () => {
    try {
      const response = await utilitiesApi.getDocumentation();
      const docsData = response.data as DocumentationInfo;
      setDocsInfo(docsData);
      setHealthCheck({
        status: docsData.health.status,
        checks: docsData.health.checks,
        lastChecked: docsData.lastUpdated,
      });
    } catch (error) {
      toast.error('Failed to load documentation information');
    }
  };

  const refreshDocumentation = async () => {
    setRefreshing(true);
    try {
      const response = await utilitiesApi.refreshDocumentation();
      const docsData = response.data as DocumentationInfo;
      setDocsInfo(docsData);
      setHealthCheck({
        status: docsData.health.status,
        checks: docsData.health.checks,
        lastChecked: docsData.lastUpdated,
      });
      toast.success('Documentation refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh documentation');
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastUpdated = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    fetchDocumentationInfo();
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Loading documentation...</span>
      </div>
    );
  }

  if (!docsInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="h-8 w-8 text-red-600" />
        <span className="ml-2 text-sm text-gray-600">Failed to load documentation</span>
      </div>
    );
  }

  const totalEndpoints = docsInfo.features.backend.apiEndpoints;
  const totalServices = docsInfo.features.backend.services;
  const totalTables = docsInfo.features.backend.databaseTables;
  const allDocsExist = docsInfo.documentation.claudeMd.exists &&
                     docsInfo.documentation.readmeMd.exists;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Documentation Dashboard</h2>
        <Button
          variant="outline"
          onClick={refreshDocumentation}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getHealthIcon(healthCheck?.status || 'unknown')}
            System Health
          </CardTitle>
          <CardDescription>
            Last checked: {healthCheck ? formatLastUpdated(healthCheck.lastChecked) : 'Never'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`rounded-lg p-4 border ${getHealthColor(healthCheck?.status || 'unknown')}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                {healthCheck?.checks.documentation ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Documentation Files</span>
              </div>
              <div className="flex items-center space-x-2">
                {healthCheck?.checks.tests ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Test Status</span>
              </div>
              <div className="flex items-center space-x-2">
                {healthCheck?.checks.builds ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">Build Status</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Version & Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Version:</span>
              <Badge variant="outline">{docsInfo.version}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Environment:</span>
              <Badge
                variant={docsInfo.environment === 'production' ? 'default' : 'secondary'}
              >
                {docsInfo.environment}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Last Updated:</span>
              <span className="text-xs text-gray-500">
                {formatLastUpdated(docsInfo.lastUpdated)}
              </span>
            </div>
            {docsInfo.lastCommitHash && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Git Commit:</span>
                <Badge variant="outline" className="font-mono">
                  {docsInfo.lastCommitHash}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentation Files Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentation Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">CLAUDE.md:</span>
              <Badge variant={docsInfo.documentation.claudeMd.exists ? 'default' : 'destructive'}>
                {docsInfo.documentation.claudeMd.exists ? 'Present' : 'Missing'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">README.md:</span>
              <Badge variant={docsInfo.documentation.readmeMd.exists ? 'default' : 'destructive'}>
                {docsInfo.documentation.readmeMd.exists ? 'Present' : 'Missing'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">API Docs:</span>
              <Badge variant={docsInfo.documentation.apiDocs.exists ? 'default' : 'secondary'}>
                {docsInfo.documentation.apiDocs.exists ? 'Present' : 'Optional'}
              </Badge>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>
                  {allDocsExist
                    ? 'All critical documentation files are present and up to date'
                    : 'Some documentation files may be missing or outdated'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Overview */}
      <Tabs defaultValue="backend" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="backend">Backend Features</TabsTrigger>
          <TabsTrigger value="frontend">Frontend Features</TabsTrigger>
        </TabsList>

        <TabsContent value="backend" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{totalTables}</div>
                <div className="text-xs text-gray-500">Database Tables</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TestTube className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{docsInfo.features.backend.tests}</div>
                <div className="text-xs text-gray-500">Backend Tests</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{totalServices}</div>
                <div className="text-xs text-gray-500">Services</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <GitBranch className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold">{totalEndpoints}</div>
                <div className="text-xs text-gray-500">API Endpoints</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="frontend" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <TestTube className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{docsInfo.features.frontend.tests}</div>
                <div className="text-xs text-gray-500">Frontend Tests</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{docsInfo.features.frontend.components}</div>
                <div className="text-xs text-gray-500">Components</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                <div className="text-2xl font-bold">{docsInfo.features.frontend.pages}</div>
                <div className="text-xs text-gray-500">Pages</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                <div className="text-2xl font-bold">{docsInfo.features.frontend.assets}</div>
                <div className="text-xs text-gray-500">Assets</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common documentation-related operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshDocumentation}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Documentation
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/Docs/API_DOCUMENTATION.md', '_blank')}
            >
              <FileText className="h-4 w-4 mr-2" />
              View API Docs
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/CLAUDE.md', '_blank')}
            >
              <FileText className="h-4 w-4 mr-2" />
              View CLAUDE.md
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/README.md', '_blank')}
            >
              <FileText className="h-4 w-4 mr-2" />
              View README.md
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}