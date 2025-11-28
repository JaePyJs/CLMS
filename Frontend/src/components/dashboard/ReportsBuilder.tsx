import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import {
  PieChart,
  TrendingUp,
  FileText,
  Download,
  Printer,
  Mail,
  Settings,
  Save,
  Play,
  Eye,
  Edit,
  Trash2,
  Plus,
  Users,
  BookOpen,
  Monitor,
  Activity,
  RefreshCw,
  Share2,
  Star,
  CalendarClock,
  BarChart,
  LineChart,
  AreaChart,
  ScatterChart,
} from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'student' | 'equipment' | 'book' | 'activity' | 'financial' | 'custom';
  category: 'summary' | 'detailed' | 'comparison' | 'trend' | 'statistical';
  chartTypes: string[];
  metrics: string[];
  filters: string[];
  columns: string[];
  isDefault: boolean;
  isFavorite: boolean;
  lastUsed?: string;
  useCount: number;
}

interface ReportConfig {
  templateId: string;
  name: string;
  dateRange: {
    start: string;
    end: string;
  };
  filters: Record<string, any>;
  metrics: string[];
  chartType: string;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  exportFormat?: 'pdf' | 'excel' | 'csv';
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

interface GeneratedReport {
  id: string;
  name: string;
  templateName: string;
  generatedAt: string;
  generatedBy: string;
  dateRange: string;
  status: 'generating' | 'completed' | 'failed';
  fileUrl?: string;
  fileSize?: number;
  recordCount?: number;
}

export function ReportsBuilder() {
  // State management
  const [activeTab, setActiveTab] = useState('templates');
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(
    []
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<ReportTemplate | null>(null);
  const [reportConfig] = useState<ReportConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Dialog states
  const [showCreateReport, setShowCreateReport] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [showScheduleReport, setShowScheduleReport] = useState(false);
  // Loading states
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Predefined templates
  const defaultTemplates: ReportTemplate[] = [
    {
      id: 'tpl_weekly_summary',
      name: 'Weekly Library Summary',
      description:
        'Overview of students, books, and borrowing trends for the week',
      type: 'custom',
      category: 'summary',
      chartTypes: ['bar', 'line'],
      metrics: ['Total Students', 'Total Books', 'Active Borrows'],
      filters: ['Active Only'],
      columns: ['Section', 'Metric', 'Value'],
      isDefault: true,
      isFavorite: false,
      useCount: 0,
    },
    {
      id: 'tpl_inventory_status',
      name: 'Inventory Status Report',
      description: 'Detailed breakdown of book categories and availability',
      type: 'book',
      category: 'detailed',
      chartTypes: ['pie'],
      metrics: ['Total Copies', 'Available Copies', 'Lost/Damaged'],
      filters: ['All Categories'],
      columns: ['Category', 'Count', 'Percentage'],
      isDefault: true,
      isFavorite: false,
      useCount: 0,
    },
    {
      id: 'tpl_activity_log',
      name: 'Student Activity Log',
      description: 'Recent student activities and library usage',
      type: 'activity',
      category: 'trend',
      chartTypes: ['bar'],
      metrics: ['Check-ins', 'Computer Usage', 'Reading'],
      filters: ['Last 30 Days'],
      columns: ['Activity', 'Count', 'Date'],
      isDefault: true,
      isFavorite: false,
      useCount: 0,
    },
  ];

  useEffect(() => {
    setReportTemplates(defaultTemplates);
    // In a real app, we would fetch saved templates and generated reports history here
  }, []);

  // Handler functions
  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setIsGenerating(true);
    try {
      // Create a record of the generated report
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        name:
          reportConfig?.name ||
          `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
        templateName: selectedTemplate.name,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Current User',
        dateRange: reportConfig?.dateRange
          ? `${reportConfig.dateRange.start} to ${reportConfig.dateRange.end}`
          : 'Last 7 Days',
        status: 'completed',
        recordCount: 0, // Would be populated by actual data
      };

      setGeneratedReports([newReport, ...generatedReports]);
      toast.success('Report generated successfully! You can now export it.');
      setShowCreateReport(false);

      // Auto-switch to generated tab
      setActiveTab('generated');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportReport = async (
    report: GeneratedReport,
    format: 'pdf' | 'excel' | 'csv'
  ) => {
    setIsExporting(true);
    try {
      // Map template type to sections
      let sections: string[] = [];
      if (report.templateName.includes('Summary'))
        sections = ['Overview', 'Trends'];
      else if (report.templateName.includes('Inventory'))
        sections = ['Overview', 'Categories'];
      else if (report.templateName.includes('Activity'))
        sections = ['Activities'];
      else sections = ['Overview', 'Categories', 'Trends', 'Activities'];

      const response = await apiClient.post('/api/analytics/export', {
        format: format === 'excel' ? 'csv' : format, // Backend supports csv/json, mapping excel to csv for now
        timeframe: 'week', // Default to week for now
        sections,
      });

      if (response) {
        // Create a blob from the response
        const blob = new Blob([response as any], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name.replace(/\s+/g, '_')}.${format === 'excel' ? 'csv' : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Report exported successfully!`);
      }
    } catch {
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveTemplate = async (template: Partial<ReportTemplate>) => {
    setIsSavingTemplate(true);
    try {
      // Simulate template saving
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newTemplate: ReportTemplate = {
        id: Date.now().toString(),
        name: template.name || 'New Template',
        description: template.description || '',
        type: template.type || 'custom',
        category: template.category || 'summary',
        chartTypes: template.chartTypes || ['bar'],
        metrics: template.metrics || [],
        filters: template.filters || [],
        columns: template.columns || [],
        isDefault: false,
        isFavorite: false,
        useCount: 0,
      };

      setReportTemplates([...reportTemplates, newTemplate]);
      toast.success('Template saved successfully!');
      setShowEditTemplate(false);
    } catch {
      toast.error('Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      setReportTemplates(reportTemplates.filter((t) => t.id !== templateId));
      toast.success('Template deleted successfully!');
    }
  };

  const handleToggleFavorite = (templateId: string) => {
    setReportTemplates(
      reportTemplates.map((t) =>
        t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t
      )
    );
  };

  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case 'bar':
        return <BarChart className="h-4 w-4" />;
      case 'pie':
        return <PieChart className="h-4 w-4" />;
      case 'line':
        return <LineChart className="h-4 w-4" />;
      case 'area':
        return <AreaChart className="h-4 w-4" />;
      case 'scatter':
        return <ScatterChart className="h-4 w-4" />;
      default:
        return <BarChart className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <Users className="h-4 w-4" />;
      case 'equipment':
        return <Monitor className="h-4 w-4" />;
      case 'book':
        return <BookOpen className="h-4 w-4" />;
      case 'activity':
        return <Activity className="h-4 w-4" />;
      case 'financial':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'summary':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'detailed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'comparison':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'trend':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'statistical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="relative">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black dark:text-foreground">
            Reports Builder
          </h2>
          <p className="text-black dark:text-muted-foreground">
            Create, customize, and generate comprehensive library reports.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="absolute top-0 right-0 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateReport(true)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditTemplate(true)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <Edit className="h-4 w-4 mr-1" />
            New Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScheduleReport(true)}
            className="bg-white/90 hover:bg-white shadow-sm"
          >
            <CalendarClock className="h-4 w-4 mr-1" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Report Builder</TabsTrigger>
          <TabsTrigger value="generated">Generated Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reportTemplates.map((template) => (
              <Card
                key={template.id}
                className={`hover:shadow-lg transition-all cursor-pointer ${
                  selectedTemplate?.id === template.id
                    ? 'ring-2 ring-blue-500'
                    : ''
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(template.type)}
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(template.id);
                      }}
                    >
                      <Star
                        className={`h-4 w-4 ${template.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
                      />
                    </Button>
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getCategoryColor(template.category)}>
                      {template.category}
                    </Badge>
                    {template.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Chart Types:</p>
                      <div className="flex gap-1">
                        {template.chartTypes.slice(0, 3).map((chartType) => (
                          <Badge
                            key={chartType}
                            variant="outline"
                            className="text-xs"
                          >
                            {getChartIcon(
                              selectedTemplate?.chartTypes[0] ?? 'bar'
                            )}
                          </Badge>
                        ))}
                        {template.chartTypes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.chartTypes.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Metrics:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.metrics.slice(0, 3).map((metric) => (
                          <Badge
                            key={metric}
                            variant="outline"
                            className="text-xs"
                          >
                            {metric}
                          </Badge>
                        ))}
                        {template.metrics.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.metrics.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Used {template.useCount} times</span>
                      {template.lastUsed && (
                        <span>Last: {template.lastUsed}</span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template);
                          setShowCreateReport(true);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Use
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        disabled={template.isDefault}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Report Builder Tab */}
        <TabsContent value="builder" className="space-y-6">
          {selectedTemplate ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Configuration Panel */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Report Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Report Name</label>
                      <Input
                        placeholder="Enter report name"
                        defaultValue={`${selectedTemplate.name} - ${new Date().toLocaleDateString()}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" placeholder="Start date" />
                        <Input type="date" placeholder="End date" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Chart Type</label>
                      <Select
                        defaultValue={selectedTemplate.chartTypes[0] ?? 'bar'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedTemplate.chartTypes.map((chartType) => (
                            <SelectItem key={chartType} value={chartType}>
                              <div className="flex items-center gap-2">
                                {getChartIcon(chartType)}
                                {chartType.charAt(0).toUpperCase() +
                                  chartType.slice(1)}{' '}
                                Chart
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Group By</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grouping" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                          <SelectItem value="grade_level">
                            Grade Level
                          </SelectItem>
                          <SelectItem value="activity_type">
                            Activity Type
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Sort By</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sort field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                          <SelectItem value="duration">Duration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Filters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedTemplate.filters.map((filter) => (
                      <div key={filter}>
                        <label className="text-sm font-medium capitalize">
                          {filter.replace('_', ' ')}
                        </label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${filter}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Preview Panel */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Report Preview
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPreviewing(!isPreviewing)}
                        >
                          {isPreviewing ? 'Hide Preview' : 'Show Preview'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleGenerateReport}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Generate Report
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isPreviewing ? (
                      <div className="space-y-4">
                        {/* Mock Chart Preview */}
                        <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            {getChartIcon(
                              selectedTemplate.chartTypes[0] ?? 'bar'
                            )}
                            <p className="mt-2 text-muted-foreground">
                              {(selectedTemplate.chartTypes[0] ?? 'bar')
                                .charAt(0)
                                .toUpperCase() +
                                (selectedTemplate.chartTypes[0] ?? 'bar').slice(
                                  1
                                )}{' '}
                              Chart Preview
                            </p>
                          </div>
                        </div>
                        {/* Mock Data Table */}
                        <div className="border rounded-lg">
                          <div className="grid grid-cols-3 gap-4 p-3 bg-muted font-medium text-sm">
                            {(selectedTemplate.columns?.slice(0, 3) ?? []).map(
                              (column) => (
                                <div key={column}>
                                  {column.replace('_', ' ').toUpperCase()}
                                </div>
                              )
                            )}
                          </div>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <div
                              key={index}
                              className="grid grid-cols-3 gap-4 p-3 border-t text-sm"
                            >
                              <div>Sample Data {index + 1}</div>
                              <div>Value {index + 1}</div>
                              <div>Status {index + 1}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Click "Show Preview" to see report preview
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Select a template from the Templates tab to start building
                  your report
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Generated Reports Tab */}
        <TabsContent value="generated" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Reports</span>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generatedReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          report.status === 'completed'
                            ? 'bg-green-500'
                            : report.status === 'generating'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {report.templateName} • {report.dateRange} • Generated
                          by {report.generatedBy}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {report.generatedAt &&
                            new Date(report.generatedAt).toLocaleString()}
                          {report.recordCount &&
                            ` • ${report.recordCount} records`}
                          {report.fileSize &&
                            ` • ${(report.fileSize / 1024 / 1024).toFixed(2)} MB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          report.status === 'completed'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {report.status}
                      </Badge>
                      {report.status === 'completed' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportReport(report, 'pdf')}
                            disabled={isExporting}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info(
                                'Email report - would open email dialog'
                              )
                            }
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info(
                                'Print report - would open print dialog'
                              )
                            }
                          >
                            <Printer className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toast.info(
                                'Share report - would open share dialog'
                              )
                            }
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scheduled Reports Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Scheduled Reports</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleReport(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </CardTitle>
              <CardDescription>
                Automate report generation and delivery on a regular schedule.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <CalendarClock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No scheduled reports yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click "Add Schedule" to create your first scheduled report
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Report Dialog */}
      <Dialog open={showCreateReport} onOpenChange={setShowCreateReport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
            <DialogDescription>
              Configure and generate a new report using your selected template.
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Report Name *</label>
                    <Input
                      placeholder="Enter report name"
                      defaultValue={`${selectedTemplate.name} - ${new Date().toLocaleDateString()}`}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input placeholder="Enter report description" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date Range *</label>
                    <div className="space-y-2">
                      <Input type="date" />
                      <Input type="date" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Export Format</label>
                    <Select defaultValue="pdf">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                        <SelectItem value="csv">CSV File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filters */}
                <div className="space-y-4">
                  <h4 className="font-medium">Filters</h4>
                  {selectedTemplate.filters.map((filter) => (
                    <div key={filter}>
                      <label className="text-sm font-medium capitalize">
                        {filter.replace('_', ' ')}
                      </label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${filter}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Metrics Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium">Metrics to Include</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedTemplate.metrics.map((metric) => (
                      <div key={metric} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={metric}
                          defaultChecked={true}
                          className="rounded"
                        />
                        <label htmlFor={metric} className="text-sm font-medium">
                          {metric.replace('_', ' ').charAt(0).toUpperCase() +
                            metric.replace('_', ' ').slice(1)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schedule Options */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">
                  Schedule Options (Optional)
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="schedule" className="rounded" />
                    <label htmlFor="schedule" className="text-sm font-medium">
                      Schedule this report
                    </label>
                  </div>
                  <div>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateReport(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEditTemplate} onOpenChange={setShowEditTemplate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Design a custom report template for your specific needs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Template Name *</label>
                <Input placeholder="Enter template name" />
              </div>
              <div>
                <label className="text-sm font-medium">Type *</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Enter template description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="comparison">Comparison</SelectItem>
                    <SelectItem value="trend">Trend</SelectItem>
                    <SelectItem value="statistical">Statistical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Default Chart Type
                </label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                    <SelectItem value="scatter">Scatter Plot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Available Filters</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  'date_range',
                  'grade_level',
                  'activity_type',
                  'status',
                  'equipment_type',
                ].map((filter) => (
                  <div key={filter} className="flex items-center space-x-2">
                    <input type="checkbox" id={filter} className="rounded" />
                    <label htmlFor={filter} className="text-sm">
                      {filter.replace('_', ' ').charAt(0).toUpperCase() +
                        filter.replace('_', ' ').slice(1)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditTemplate(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveTemplate({})}
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Report Dialog */}
      <Dialog open={showScheduleReport} onOpenChange={setShowScheduleReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>
              Set up automatic report generation and delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Template</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {reportTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Frequency</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Recipients</label>
              <Input placeholder="Enter email addresses (comma separated)" />
            </div>
            <div>
              <label className="text-sm font-medium">Delivery Time</label>
              <Input type="time" defaultValue="09:00" />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-attachments"
                className="rounded"
                defaultChecked
              />
              <label
                htmlFor="include-attachments"
                className="text-sm font-medium"
              >
                Include report as attachment
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowScheduleReport(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success('Report scheduled successfully!');
                setShowScheduleReport(false);
              }}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReportsBuilder;
