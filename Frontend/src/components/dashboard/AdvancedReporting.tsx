import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { LoadingSpinner, ButtonLoading } from '@/components/LoadingStates';
import { FileText, Download, TrendingUp, BarChart3, Target, Users, Settings, AlertTriangle, CheckCircle, Clock, Plus, Trash2, Edit } from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'operational' | 'strategic' | 'administrative' | 'financial' | 'performance';
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'on_demand';
  sections: ReportSection[];
  includeInsights: boolean;
  includeForecasts: boolean;
  includeHeatMaps: boolean;
  includeROI: boolean;
  includeBenchmarks: boolean;
  includeReadingPatterns: boolean;
  includeSpaceUtilization: boolean;
}

interface ReportSection {
  id: string;
  type: 'overview' | 'kpi' | 'chart' | 'table' | 'insights' | 'heatmap' | 'forecast' | 'roi' | 'benchmark' | 'reading_patterns' | 'space_utilization';
  title: string;
  enabled: boolean;
  order: number;
}

interface ReportConfig {
  id?: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  recipients: string[];
  format: 'html' | 'pdf' | 'excel' | 'csv' | 'json';
  is_active: boolean;
  schedule?: string;
  sections: ReportSection[];
}

interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: string;
  generated_at: string;
  status: 'generating' | 'completed' | 'failed';
  summary: string;
  filePath?: string;
}

interface AlertConfig {
  id: string;
  name: string;
  type: string;
  threshold: number;
  operators: string;
  recipients: string[];
  is_active: boolean;
  cooldownPeriod: number;
  lastTriggered?: string;
}

export function AdvancedReporting() {
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ReportConfig | null>(null);
  const isLargeScreen = useBreakpoint('lg');

  // Mock data for demonstration
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'weekly_operational',
      name: 'Weekly Operational Report',
      description: 'Comprehensive weekly operational overview with KPIs and insights',
      category: 'operational',
      type: 'weekly',
      sections: [
        { id: 'overview', type: 'overview', title: 'Library Overview', enabled: true, order: 1 },
        { id: 'kpi', type: 'kpi', title: 'Key Performance Indicators', enabled: true, order: 2 },
        { id: 'activities', type: 'table', title: 'Recent Activities', enabled: true, order: 3 },
        { id: 'insights', type: 'insights', title: 'Predictive Insights', enabled: true, order: 4 }
      ],
      includeInsights: true,
      includeForecasts: false,
      includeHeatMaps: false,
      includeROI: false,
      includeBenchmarks: false,
      includeReadingPatterns: false,
      includeSpaceUtilization: false
    },
    {
      id: 'monthly_strategic',
      name: 'Monthly Strategic Report',
      description: 'Strategic analysis with ROI, benchmarks, and long-term trends',
      category: 'strategic',
      type: 'monthly',
      sections: [
        { id: 'overview', type: 'overview', title: 'Executive Summary', enabled: true, order: 1 },
        { id: 'kpi', type: 'kpi', title: 'Performance Metrics', enabled: true, order: 2 },
        { id: 'roi', type: 'roi', title: 'Return on Investment', enabled: true, order: 3 },
        { id: 'benchmarks', type: 'benchmark', title: 'Industry Benchmarks', enabled: true, order: 4 },
        { id: 'insights', type: 'insights', title: 'Strategic Insights', enabled: true, order: 5 }
      ],
      includeInsights: true,
      includeForecasts: true,
      includeHeatMaps: true,
      includeROI: true,
      includeBenchmarks: true,
      includeReadingPatterns: false,
      includeSpaceUtilization: false
    },
    {
      id: 'reading_analytics',
      name: 'Student Reading Analytics',
      description: 'Detailed analysis of student reading patterns and engagement',
      category: 'administrative',
      type: 'monthly',
      sections: [
        { id: 'overview', type: 'overview', title: 'Reading Program Overview', enabled: true, order: 1 },
        { id: 'reading_patterns', type: 'reading_patterns', title: 'Reading Patterns', enabled: true, order: 2 },
        { id: 'activities', type: 'table', title: 'Top Readers', enabled: true, order: 3 },
        { id: 'insights', type: 'insights', title: 'Reading Insights', enabled: true, order: 4 }
      ],
      includeInsights: true,
      includeForecasts: false,
      includeHeatMaps: false,
      includeROI: false,
      includeBenchmarks: true,
      includeReadingPatterns: true,
      includeSpaceUtilization: false
    },
    {
      id: 'space_utilization',
      name: 'Space Utilization Report',
      description: 'Analysis of library space usage and optimization recommendations',
      category: 'operational',
      type: 'weekly',
      sections: [
        { id: 'overview', type: 'overview', title: 'Space Overview', enabled: true, order: 1 },
        { id: 'space_utilization', type: 'space_utilization', title: 'Area Utilization', enabled: true, order: 2 },
        { id: 'heatmap', type: 'heatmap', title: 'Usage Heat Map', enabled: true, order: 3 },
        { id: 'insights', type: 'insights', title: 'Space Optimization Insights', enabled: true, order: 4 }
      ],
      includeInsights: true,
      includeForecasts: false,
      includeHeatMaps: true,
      includeROI: false,
      includeBenchmarks: false,
      includeReadingPatterns: false,
      includeSpaceUtilization: true
    }
  ];

  const mockReports: GeneratedReport[] = [
    {
      id: '1',
      name: 'Weekly Operational Report',
      type: 'weekly',
      format: 'html',
      generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      summary: 'Library performance shows 15% increase in student engagement this week.',
      filePath: '/reports/weekly_operational_1.html'
    },
    {
      id: '2',
      name: 'Monthly Strategic Report',
      type: 'monthly',
      format: 'pdf',
      generated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      summary: 'ROI analysis shows 23.3% return on investment with positive trends in technology adoption.',
      filePath: '/reports/monthly_strategic_2.pdf'
    },
    {
      id: '3',
      name: 'Space Utilization Report',
      type: 'weekly',
      format: 'excel',
      generated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'generating',
      summary: 'Currently generating space utilization analysis...',
    }
  ];

  const mockAlerts: AlertConfig[] = [
    {
      id: '1',
      name: 'High Usage Alert',
      type: 'usage_spike',
      threshold: 100,
      operators: 'greater_than',
      recipients: ['admin@library.edu'],
      is_active: true,
      cooldownPeriod: 30,
      lastTriggered: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      name: 'Resource Shortage Alert',
      type: 'resource_shortage',
      threshold: 80,
      operators: 'greater_than',
      recipients: ['admin@library.edu', 'manager@library.edu'],
      is_active: true,
      cooldownPeriod: 15,
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      name: 'System Health Monitor',
      type: 'system_health',
      threshold: 85,
      operators: 'greater_than',
      recipients: ['admin@library.edu'],
      is_active: false,
      cooldownPeriod: 60
    }
  ];

  useEffect(() => {
    setGeneratedReports(mockReports);
    setAlertConfigs(mockAlerts);
  }, []);

  const handleGenerateReport = async (template: ReportTemplate, format: string) => {
    setIsGenerating(true);
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        name: template.name,
        type: template.type,
        format,
        generated_at: new Date().toISOString(),
        status: 'completed',
        summary: `Generated ${template.name} in ${format} format successfully.`,
        filePath: `/reports/${template.name}_${Date.now()}.${format}`
      };

      setGeneratedReports(prev => [newReport, ...prev]);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveConfig = (config: ReportConfig) => {
    if (editingConfig) {
      setReportConfigs(prev => prev.map(c => c.id === editingConfig.id ? { ...config, id: editingConfig.id } : c));
    } else {
      setReportConfigs(prev => [...prev, { ...config, id: Date.now().toString() }]);
    }
    setShowConfigDialog(false);
    setEditingConfig(null);
  };

  const handleDeleteConfig = (id: string) => {
    setReportConfigs(prev => prev.filter(c => c.id !== id));
  };

  const handleToggleAlert = (id: string) => {
    setAlertConfigs(prev => prev.map(a =>
      a.id === id ? { ...a, is_active: !a.is_active } : a
    ));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'operational': return 'bg-blue-100 text-blue-800';
      case 'strategic': return 'bg-purple-100 text-purple-800';
      case 'administrative': return 'bg-green-100 text-green-800';
      case 'financial': return 'bg-yellow-100 text-yellow-800';
      case 'performance': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'generating': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Advanced Reporting</h2>
          <p className="text-muted-foreground">
            Generate comprehensive reports with advanced analytics and insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfigDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Custom Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="configs">Configs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reportTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    </div>
                    <Badge className={getCategoryColor(template.category)}>
                      {template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{template.type}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {template.includeInsights && <Badge variant="secondary">Insights</Badge>}
                      {template.includeROI && <Badge variant="secondary">ROI</Badge>}
                      {template.includeBenchmarks && <Badge variant="secondary">Benchmarks</Badge>}
                      {template.includeReadingPatterns && <Badge variant="secondary">Reading</Badge>}
                      {template.includeSpaceUtilization && <Badge variant="secondary">Space</Badge>}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Select onValueChange={(format) => handleGenerateReport(template, format)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Generate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>
                View and download your generated reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generatedReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(report.status)}
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.generated_at).toLocaleString()} • {report.format.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{report.type}</Badge>
                      {report.status === 'completed' && report.filePath && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      {report.status === 'generating' && (
                        <ButtonLoading loading size="sm">
                          Generating...
                        </ButtonLoading>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configs Tab */}
        <TabsContent value="configs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Configurations</CardTitle>
              <CardDescription>
                Manage your scheduled and custom report configurations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportConfigs.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Report Configurations</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first custom report configuration.
                    </p>
                    <Button onClick={() => setShowConfigDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Configuration
                    </Button>
                  </div>
                ) : (
                  reportConfigs.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{config.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {config.type} • {config.format.toUpperCase()} • {config.recipients.length} recipients
                        </p>
                        {config.schedule && (
                          <p className="text-sm text-muted-foreground">
                            Schedule: {config.schedule}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.is_active ? 'default' : 'secondary'}>
                          {config.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteConfig(config.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configurations</CardTitle>
              <CardDescription>
                Manage automated alerts for system monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alertConfigs.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{alert.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {alert.type.replace('_', ' ')} • Threshold: {alert.threshold} • {alert.recipients.length} recipients
                      </p>
                      {alert.lastTriggered && (
                        <p className="text-sm text-muted-foreground">
                          Last triggered: {new Date(alert.lastTriggered).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={alert.is_active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleAlert(alert.id)}
                      >
                        {alert.is_active ? 'Active' : 'Inactive'}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  ROI Analysis
                </CardTitle>
                <CardDescription>
                  Financial performance and return on investment metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Investment</span>
                    <span className="font-medium">$150,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Value</span>
                    <span className="font-medium text-green-600">$185,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ROI</span>
                    <span className="font-medium text-green-600">+23.3%</span>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Reading Patterns
                </CardTitle>
                <CardDescription>
                  Student engagement and reading behavior analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Books Read</span>
                    <span className="font-medium">1,250</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Readers</span>
                    <span className="font-medium">85</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Reading Streak</span>
                    <span className="font-medium">4.2 days</span>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Space Utilization
                </CardTitle>
                <CardDescription>
                  Library space usage and optimization insights.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Computer Lab</span>
                    <span className="font-medium">73.3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reading Lounge</span>
                    <span className="font-medium text-yellow-600">30.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gaming Zone</span>
                    <span className="font-medium">85.2%</span>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Benchmarks
                </CardTitle>
                <CardDescription>
                  Industry comparison and performance metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Visits per Student</span>
                    <span className="font-medium text-yellow-600">7.2 (8.5)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Book Circulation</span>
                    <span className="font-medium text-green-600">18.5 (15.2)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Computer Usage</span>
                    <span className="font-medium text-green-600">71.3% (65.0%)</span>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>
                Export data in various formats for external analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Export Type</h3>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select data type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activities">Activities</SelectItem>
                      <SelectItem value="students">Students</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="reading-patterns">Reading Patterns</SelectItem>
                      <SelectItem value="space-utilization">Space Utilization</SelectItem>
                      <SelectItem value="roi-data">ROI Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Format</h3>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 mt-6">
                <h3 className="text-lg font-medium">Date Range</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Input type="date" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Input type="date" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custom Report Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Report Configuration' : 'Create Custom Report'}
            </DialogTitle>
            <DialogDescription>
              Configure a custom report with specific sections and delivery options.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Report Name</label>
                <Input placeholder="Enter report name" />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="strategic">Strategic</SelectItem>
                    <SelectItem value="administrative">Administrative</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Enter report description" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Format</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Schedule</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="on_demand">On Demand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Recipients</label>
              <Input placeholder="Enter email addresses (comma separated)" />
            </div>

            <div>
              <label className="text-sm font-medium">Include Sections</label>
              <div className="grid gap-2 mt-2">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'kpi', label: 'Key Performance Indicators' },
                  { id: 'insights', label: 'Predictive Insights' },
                  { id: 'roi', label: 'ROI Analysis' },
                  { id: 'benchmarks', label: 'Industry Benchmarks' },
                  { id: 'reading_patterns', label: 'Reading Patterns' },
                  { id: 'space_utilization', label: 'Space Utilization' },
                ].map((section) => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox id={section.id} />
                    <label htmlFor={section.id} className="text-sm">
                      {section.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveConfig(editingConfig || {} as ReportConfig)}>
              {editingConfig ? 'Update' : 'Create'} Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdvancedReporting;