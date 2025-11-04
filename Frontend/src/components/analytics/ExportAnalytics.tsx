import { useState, type ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Download, Clock, BarChart, FileText, Settings, FileSpreadsheet, Calendar, File as FileIcon } from 'lucide-react'

interface ExportAnalyticsProps {
  timeframe: 'day' | 'week' | 'month'
  onExport: (format: 'csv' | 'json' | 'pdf', sections: string[]) => Promise<void>
  isExporting?: boolean
}

interface ExportSection {
  id: string
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  defaultIncluded: boolean
}

interface ExportFormat {
  id: 'csv' | 'json' | 'pdf'
  name: string
  description: string
  icon: ComponentType<{ className?: string }>
  fileSize: string
  processingTime: string
}

export function ExportAnalytics({ timeframe, onExport, isExporting = false }: ExportAnalyticsProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('pdf')
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeRawData, setIncludeRawData] = useState(false)
  const [customDateRange, setCustomDateRange] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const exportSections: ExportSection[] = [
    {
      id: 'overview',
      name: 'Library Overview',
      description: 'General library statistics and metrics',
      icon: BarChart,
      defaultIncluded: true
    },
    {
      id: 'circulation',
      name: 'Book Circulation',
      description: 'Book borrowing, returns, and overdue analysis',
      icon: FileText,
      defaultIncluded: true
    },
    {
      id: 'equipment',
      name: 'Equipment Utilization',
      description: 'Equipment usage patterns and maintenance insights',
      icon: Settings,
      defaultIncluded: true
    },
    {
      id: 'fines',
      name: 'Fine Collection',
      description: 'Fine payment trends and collection analytics',
      icon: FileSpreadsheet,
      defaultIncluded: false
    },
    {
      id: 'trends',
      name: 'Usage Trends',
      description: 'Historical data and trend analysis',
      icon: Calendar,
      defaultIncluded: false
    },
    {
      id: 'demographics',
      name: 'User Demographics',
      description: 'Student usage patterns by grade and category',
      icon: FileIcon,
      defaultIncluded: false
    }
  ]

  const exportFormats: ExportFormat[] = [
    {
      id: 'pdf',
      name: 'PDF Report',
      description: 'Professional formatted report with charts and visualizations',
      icon: FileText,
      fileSize: '~2-5 MB',
      processingTime: '~30 seconds'
    },
    {
      id: 'csv',
      name: 'CSV Data',
      description: 'Raw data in comma-separated values format',
      icon: FileSpreadsheet,
      fileSize: '~500 KB - 1 MB',
      processingTime: '~10 seconds'
    },
    {
      id: 'json',
      name: 'JSON Data',
      description: 'Structured data format for developers and APIs',
      icon: FileIcon,
      fileSize: '~1-2 MB',
      processingTime: '~15 seconds'
    }
  ]

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSections(prev => [...prev, sectionId])
    } else {
      setSelectedSections(prev => prev.filter(id => id !== sectionId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSections(exportSections.map(section => section.id))
    } else {
      setSelectedSections([])
    }
  }

  const handleExport = async () => {
    try {
      setExportProgress(0)

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      await onExport(selectedFormat, selectedSections.length > 0 ? selectedSections : ['all'])

      setExportProgress(100)
      setTimeout(() => {
        setIsDialogOpen(false)
        setExportProgress(0)
      }, 1000)
    } catch (error) {
      console.error('Export failed:', error)
      setExportProgress(0)
    }
  }

  const getSelectedSectionsInfo = () => {
    const count = selectedSections.length > 0 ? selectedSections.length : exportSections.length
    return `${count} section${count !== 1 ? 's' : ''} selected`
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Analytics
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Analytics Report</DialogTitle>
          <DialogDescription>
            Generate comprehensive analytics reports in various formats
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <h4 className="text-sm font-medium mb-3">Export Format</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {exportFormats.map((format) => (
                <Card
                  key={format.id}
                  className={`cursor-pointer transition-all ${
                    selectedFormat === format.id
                      ? 'ring-2 ring-primary border-primary'
                      : 'hover:border-primary'
                  }`}
                  onClick={() => setSelectedFormat(format.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <format.icon className="h-5 w-5" />
                      <CardTitle className="text-sm">{format.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-2">
                      {format.description}
                    </p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{format.fileSize}</span>
                      <span>{format.processingTime}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sections Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Report Sections</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getSelectedSectionsInfo()}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll(selectedSections.length !== exportSections.length)}
                >
                  {selectedSections.length === exportSections.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {exportSections.map((section) => (
                <div key={section.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={section.id}
                    checked={selectedSections.includes(section.id) || (selectedSections.length === 0 && section.defaultIncluded)}
                    onCheckedChange={(checked) => handleSectionToggle(section.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={section.id}
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <section.icon className="h-4 w-4" />
                      {section.name}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div>
            <h4 className="text-sm font-medium mb-3">Export Options</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="charts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked === true)}
                />
                <label htmlFor="charts" className="text-sm">
                  Include charts and visualizations
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="raw-data"
                  checked={includeRawData}
                  onCheckedChange={(checked) => setIncludeRawData(checked === true)}
                />
                <label htmlFor="raw-data" className="text-sm">
                  Include raw data tables
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="custom-range"
                  checked={customDateRange}
                  onCheckedChange={(checked) => setCustomDateRange(checked === true)}
                />
                <label htmlFor="custom-range" className="text-sm">
                  Use custom date range
                </label>
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Generating Report...</span>
                <span className="text-sm text-muted-foreground">{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>This may take a few moments depending on the selected options</span>
              </div>
            </div>
          )}

          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {exportFormats.find(f => f.id === selectedFormat)?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">Format</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {getSelectedSectionsInfo()}
                  </div>
                  <div className="text-xs text-muted-foreground">Sections</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {timeframe === 'day' ? 'Today' : timeframe === 'week' ? 'This Week' : 'This Month'}
                  </div>
                  <div className="text-xs text-muted-foreground">Time Period</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || (selectedSections.length === 0 && !exportSections.every(s => s.defaultIncluded))}
          >
            {isExporting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ExportAnalytics
