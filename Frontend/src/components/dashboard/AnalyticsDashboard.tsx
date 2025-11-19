import { useState, useRef } from 'react'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Clock, Activity } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, CartesianGrid, BarChart, XAxis, YAxis, Bar } from 'recharts'
import MetricsCards from '@/components/analytics/MetricsCards'
import api from '@/services/api'
import BookCirculationAnalytics from '@/components/analytics/BookCirculationAnalytics'
import EquipmentUtilizationAnalytics from '@/components/analytics/EquipmentUtilizationAnalytics'
import FineCollectionAnalytics from '@/components/analytics/FineCollectionAnalytics'
import PredictiveInsights from '@/components/analytics/PredictiveInsights'
import TimeSeriesForecast from '@/components/analytics/TimeSeriesForecast'
import UsageHeatMap from '@/components/analytics/UsageHeatMap'
import AdvancedReporting from '@/components/dashboard/AdvancedReporting'
import ExportAnalytics from '@/components/analytics/ExportAnalytics'

export function AnalyticsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [selectedChart, setSelectedChart] = useState('overview')
  const [selectedMetric, setSelectedMetric] = useState<'student_visits' | 'equipment_usage' | 'book_circulation'>('student_visits')
  const [isLoading, setIsLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [liveMetrics, setLiveMetrics] = useState<{ totalBooks?: number; overdueCount?: number; studentsCount?: number } | null>(null)
  const [categoryDistribution, setCategoryDistribution] = useState<Array<{ name: string; value: number }>>([])
  const [gradeDistribution, setGradeDistribution] = useState<Array<{ grade: string; students: number; percentage: number }>>([])
  const [popularTimesDay, setPopularTimesDay] = useState<Array<{ time: string; students: number }>>([])
  const [popularTimesWeek, setPopularTimesWeek] = useState<Array<{ day: string; students: number }>>([])
  const [popularTimesMonth, setPopularTimesMonth] = useState<Array<{ week: string; students: number }>>([])
  const [activityDistribution, setActivityDistribution] = useState<Array<{ name: string; value: number }>>([])
  const [circulationData, setCirculationData] = useState<any>(null)
  const [equipmentData, setEquipmentData] = useState<any>(null)
  const [finesData, setFinesData] = useState<any>(null)
  const [topUsers, setTopUsers] = useState<Array<{ name: string; borrows: number }>>([])

  const activityPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#22c55e', '#14b8a6', '#a855f7', '#f97316']
  const knownActivityColors: Record<string, string> = {
    'Computer Use': '#3b82f6',
    'Gaming': '#8b5cf6',
    'Book Borrowing': '#10b981',
    'Book Return': '#f59e0b',
    'VR Sessions': '#ef4444',
    'Study': '#6366f1',
  }
  const pickColor = (name: string) => {
    const key = (name || '').trim()
    if (knownActivityColors[key]) return knownActivityColors[key]
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
    return activityPalette[hash % activityPalette.length]
  }

  const activityChartHeight = 300
  const mockActivityData = [
    { name: 'Computer Use', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Gaming', value: 20, color: '#8b5cf6' },
    { name: 'Book Borrowing', value: 25, color: '#10b981' },
    { name: 'Book Return', value: 20, color: '#f59e0b' },
    { name: 'VR Sessions', value: 5, color: '#ef4444' },
    { name: 'Study', value: 15, color: '#6366f1' }
  ]
  const mockUsageData = {
    day: [
      { time: '8AM', students: 5 },
      { time: '9AM', students: 12 },
      { time: '10AM', students: 18 }
    ],
    week: [
      { day: 'Mon', students: 45 },
      { day: 'Tue', students: 52 },
      { day: 'Wed', students: 48 }
    ],
    month: [
      { week: 'Week 1', students: 220 },
      { week: 'Week 2', students: 245 },
      { week: 'Week 3', students: 238 }
    ]
  }
  const currentUsageData = mockUsageData[selectedPeriod]
  const mockGradeDistribution = [
    { grade: 'Primary', students: 25, percentage: 20 },
    { grade: 'Grade School', students: 50, percentage: 40 },
    { grade: 'Junior High', students: 35, percentage: 28 },
    { grade: 'Senior High', students: 15, percentage: 12 }
  ]

  const handleRefresh = () => {
    setIsLoading(true)
    setLastRefresh(new Date())
    setIsLoading(false)
  }

  const fetchLiveMetrics = async () => {
    try {
      setIsLoading(true)
      const [booksRes, overdueRes, studentsRes] = await Promise.all([
        api.get('/books', { signal: cancelRef.current?.signal }),
        api.get('/borrows/list/overdue', { signal: cancelRef.current?.signal }),
        api.get('/students', { signal: cancelRef.current?.signal }),
      ])
      const totalBooks = Array.isArray(booksRes.data?.data) ? booksRes.data.data.length : (booksRes.data?.total || 0)
      const overdueCount = Array.isArray(overdueRes.data?.data) ? overdueRes.data.data.length : (overdueRes.data?.count || 0)
      const studentsCount = Array.isArray(studentsRes.data?.data) ? studentsRes.data.data.length : (studentsRes.data?.count || 0)
      setLiveMetrics({ totalBooks, overdueCount, studentsCount })
      try {
        const analyticsRes = await api.get('/analytics/dashboard', { signal: cancelRef.current?.signal })
        const categories: Array<{ category?: string; material_type?: string; _count?: { id?: number; category?: number; material_type?: number } }> = analyticsRes.data?.data?.books_by_category || []
        const catRows = categories.map((c) => ({ name: (c.category || c.material_type || 'Unknown') as string, value: Number((c._count?.id ?? c._count?.category ?? c._count?.material_type) || 0) }))
        setCategoryDistribution(catRows)

        const byGrade: Array<{ grade_level: string; _count: { id: number } }> = analyticsRes.data?.data?.students_by_grade || []
        const total = Number(analyticsRes.data?.data?.overview?.total_students || 0)
        const gradeRows = byGrade.map(g => ({ grade: g.grade_level, students: g._count.id, percentage: total > 0 ? Math.round((g._count.id / total) * 100) : 0 }))
        setGradeDistribution(gradeRows)

        const byHour: Array<{ hour: number; count: number }> = analyticsRes.data?.data?.borrows_by_hour || []
        const formatHour = (h: number) => {
          const hh = h % 24
          const suffix = hh < 12 ? 'AM' : 'PM'
          const display = hh % 12 === 0 ? 12 : hh % 12
          return `${display}${suffix}`
        }
        const times = byHour.map(({ hour, count }) => ({ time: formatHour(hour), students: count }))
        setPopularTimesDay(times)

        const byDay: Array<{ date: string; count: number }> = analyticsRes.data?.data?.borrows_by_day || []
        const last7 = byDay.slice(Math.max(0, byDay.length - 7))
        const days = last7.map(({ date, count }) => {
          const d = new Date(date)
          const day = d.toLocaleDateString(undefined, { weekday: 'short' })
          return { day, students: count }
        })
        setPopularTimesWeek(days)

        const byWeek: Array<{ weekStart: string; count: number }> = analyticsRes.data?.data?.borrows_by_week || []
        const last4 = byWeek.slice(Math.max(0, byWeek.length - 4))
        const weeks = last4.map((entry) => {
          const d = new Date(entry.weekStart)
          const label = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
          return { week: label, students: entry.count }
        })
        setPopularTimesMonth(weeks)
        const activities: Array<{ activity_type: string; _count: { id: number } }> = analyticsRes.data?.data?.activity_distribution || []
        const actRows = activities.map(a => ({ name: a.activity_type || 'Activity', value: a._count.id, color: pickColor(a.activity_type || 'Activity') }))
        setActivityDistribution(actRows)

        try {
          const topUsersApi: Array<{ first_name?: string; last_name?: string; student_id?: string; active_borrows?: number }> = analyticsRes.data?.data?.top_users || []
          if (Array.isArray(topUsersApi) && topUsersApi.length > 0) {
            const wiredTop = topUsersApi
              .map(u => {
                const fullName = `${String(u.first_name || '').trim()} ${String(u.last_name || '').trim()}`.trim()
                const name = fullName || String(u.student_id || 'Unknown')
                return { name, borrows: Number(u.active_borrows || 0) }
              })
              .sort((a, b) => b.borrows - a.borrows)
              .slice(0, 5)
            setTopUsers(wiredTop)
          } else {
            try {
              const borrowsRes = await api.get('/borrows?limit=100', { signal: cancelRef.current?.signal })
              const rows: any[] = Array.isArray(borrowsRes.data?.data) ? borrowsRes.data.data : []
              const counts: Record<string, number> = {}
              for (const r of rows) {
                const name = `${String(r.student?.first_name || '')} ${String(r.student?.last_name || '')}`.trim() || String(r.student?.student_id || 'Unknown')
                counts[name] = (counts[name] || 0) + 1
              }
              const sorted = Object.entries(counts).map(([name, borrows]) => ({ name, borrows })).sort((a, b) => b.borrows - a.borrows).slice(0, 5)
              setTopUsers(sorted)
            } catch {}
          }

          const periodDays = selectedPeriod === 'day' ? 1 : selectedPeriod === 'week' ? 7 : 30
          const booksAnalytics = await api.get(`/analytics/books?period=${periodDays}`, { signal: cancelRef.current?.signal })
          const booksData = booksAnalytics.data?.data || {}
          const circByCategory = (booksData.books_by_category || []).map((c: any, idx: number) => ({ category: c.category || 'Unknown', count: Number(c._count?.id || 0), percentage: 0, color: ['#0088FE','#00C49F','#FFBB28','#FF8042','#8884D8','#82CA9D','#FFC658','#FF7C7C'][idx % 8] }))
          const total = circByCategory.reduce((s: number, it: any) => s + it.count, 0)
          const withPct = circByCategory.map((it: any) => ({ ...it, percentage: total > 0 ? Math.round((it.count / total) * 100) : 0 }))
          const topBooks = (booksData.top_books || []).map((b: any) => ({ id: String(b.id), title: b.title, author: b.author, category: b.category, circulationCount: Number(b.checkout_count || 0), popularity: Math.min(100, Math.round((Number(b.checkout_count || 0) / Math.max(1, Number(b.total_copies || 1))) * 100)), availableCopies: Number(b.available_copies || 0), totalCopies: Number(b.total_copies || 0) }))
          const dashboardStats = analyticsRes.data?.data?.statistics || {}
          setCirculationData({
            circulationByCategory: withPct,
            mostBorrowedBooks: topBooks,
            totalCirculation: total,
            trends: { growthRate: 0 },
            circulation: { circulationRate: 0, returnRate: Number(dashboardStats.return_rate || 0), overdueRate: Number(dashboardStats.overdue_rate || 0) },
            overdueAnalysis: { overdueByCategory: [], totalOverdue: 0, averageOverdueDays: 0 },
          })

          const equipmentAnalytics = await api.get(`/analytics/equipment?period=${periodDays}`, { signal: cancelRef.current?.signal })
          const eq = equipmentAnalytics.data?.data || {}
          const byCat = (eq.equipment_by_category || []).map((c: any) => ({ type: c.category || 'Unknown', total: Number(c._count?.id || 0), inUse: 0, utilizationRate: 0 }))
          const statusCounts = Object.fromEntries(((eq.equipment_by_status || []) as any[]).map((s: any) => [s.status || 'UNKNOWN', Number(s._count?.id || 0)]))
          const totalEq = Number(eq.total_equipment || 0)
          const inUseCount = Number(statusCounts['IN_USE'] || 0)
          const overallUtil = totalEq > 0 ? Math.round((inUseCount / totalEq) * 100) : 0
          setEquipmentData({ utilizationByType: byCat, peakUsageTimes: [], maintenanceInsights: { maintenanceSchedule: [], averageUptime: 98.5, equipmentNeedingMaintenance: 0 }, overallUtilization: overallUtil, recommendations: [], equipment: { totalSessions: 0, averageSessionDuration: 0 } })

          const finesAnalytics = await api.get(`/analytics/fines?period=${periodDays}`, { signal: cancelRef.current?.signal })
          setFinesData(finesAnalytics.data?.data || null)
        } catch {}
      } catch {}
    } catch (e) {
      if ((import.meta.env.DEV) || String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development')) {
        setLiveMetrics({ totalBooks: 5, overdueCount: 1, studentsCount: 5 })
        setCategoryDistribution([
          { name: 'Fiction', value: 42 },
          { name: 'Filipiniana', value: 25 },
          { name: 'Easy Books', value: 18 },
        ])
        setGradeDistribution([
          { grade: 'Primary', students: 25, percentage: 20 },
          { grade: 'Grade School', students: 50, percentage: 40 },
          { grade: 'Junior High', students: 35, percentage: 28 },
          { grade: 'Senior High', students: 15, percentage: 12 },
        ])
        setPopularTimesDay([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const cancelRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)
  const guardRef = useRef<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRefreshLive = async () => {
    setErrorMsg(null)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        if (cancelRef.current) {
          cancelRef.current.abort()
        }
        cancelRef.current = new AbortController()
        guardRef.current = window.setTimeout(() => {
          // Failsafe to stop spinner if requests hang too long
          setIsLoading(false)
          setErrorMsg((prev) => prev || 'Analytics refresh timed out')
        }, 6000)
        await fetchLiveMetrics()
        setLastRefresh(new Date())
      } catch (e) {
        setErrorMsg('Failed to refresh analytics')
      } finally {
        cancelRef.current = null
        if (guardRef.current) {
          window.clearTimeout(guardRef.current)
          guardRef.current = null
        }
      }
    }, 200)
  }

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    if (import.meta.env.PROD && format !== 'pdf') {
      try {
        const res = await api.post('/analytics/export', { format, timeframe: selectedPeriod, sections: [] }, { responseType: 'blob' })
        const blob = res.data as Blob
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        return
      } catch {}
    }
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Overview', 'System Efficiency', '94%'],
      ['Overview', 'User Satisfaction', '87%'],
      ['Overview', 'Resource Optimization', '82%'],
      ['Circulation', 'Week-over-week', '+12%'],
      ['Circulation', 'Month-over-month', '+7%'],
      ['Circulation', 'Overdue rate', '9%'],
      ['Categories', 'Fiction', '42%'],
      ['Categories', 'Filipiniana', '25%'],
      ['Categories', 'Easy Books', '18%']
    ]
    let blob: Blob
    if (format === 'json') {
      const data = { timeframe: selectedPeriod, generatedAt: new Date().toISOString(), rows }
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    } else if (format === 'csv') {
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      blob = new Blob([csv], { type: 'text/csv' })
    } else {
      const text = `Analytics Export\nTimeframe: ${selectedPeriod}\nGenerated: ${new Date().toISOString()}`
      blob = new Blob([text], { type: 'application/pdf' })
    }
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Advanced Analytics Dashboard</h2>
          <p className="text-muted-foreground">Comprehensive library analytics with real-time insights and reporting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedPeriod} onValueChange={(v: string) => setSelectedPeriod(v as 'day' | 'week' | 'month')}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefreshLive} disabled={isLoading} aria-label="Refresh Live">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Live
          </Button>
          <ExportAnalytics timeframe={selectedPeriod} onExport={handleExport as any} isExporting={false} />
        </div>
      </div>

      {((import.meta.env.DEV) || String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development')) && !isLoading && (!liveMetrics || ((liveMetrics.totalBooks ?? 0) === 0 && (liveMetrics.studentsCount ?? 0) === 0)) && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
          Analytics are running in development mode. Sample data is displayed while the backend is offline.
        </div>
      )}

      <MetricsCards timeframe={selectedPeriod} data={liveMetrics} isLoading={isLoading} onRefresh={handleRefreshLive} />
      {errorMsg && (<div className="text-sm text-red-600 dark:text-red-400">{errorMsg}</div>)}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Users</CardTitle>
            <CardDescription>Most active patrons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {(topUsers.length ? topUsers : [
                { name: 'Alice Example', borrows: 25 },
                { name: 'Bob Student', borrows: 18 },
                { name: 'Carol Reader', borrows: 15 },
              ]).map((u, idx) => (
                <div key={`top-${idx}`} className="flex justify-between"><span>{u.name}</span><Badge variant="outline">{u.borrows} borrows</Badge></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Popular Books</CardTitle>
            <CardDescription>Most borrowed titles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {(Array.isArray(circulationData?.mostBorrowedBooks) && circulationData!.mostBorrowedBooks!.length > 0
                ? circulationData!.mostBorrowedBooks!
                : [
                    { title: 'Sample Book', author: 'John Doe', category: 'Fiction', circulationCount: 120 },
                    { title: 'Heritage', author: 'Maria Santos', category: 'Filipiniana', circulationCount: 95 },
                    { title: 'ABCs', author: 'Baby Reader', category: 'Easy Books', circulationCount: 60 },
                  ]
              ).map((b: any, idx: number) => (
                <div key={`popular-${idx}`} className="flex justify-between">
                  <span>{String(b.category || 'Category')} • {String(b.title || 'Unknown')}</span>
                  <Badge variant="outline">{Number(b.circulationCount || 0)} borrows</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedChart} onValueChange={setSelectedChart} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="circulation">Book Circulation</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="fines">Fine Collection</TabsTrigger>
          <TabsTrigger value="insights">Predictive Insights</TabsTrigger>
          <TabsTrigger value="forecasting">Forecasting</TabsTrigger>
          <TabsTrigger value="heatmap">Heat Map</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BookCirculationAnalytics timeframe={selectedPeriod} data={circulationData || undefined} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="circulation" className="space-y-4">
          <BookCirculationAnalytics timeframe={selectedPeriod} data={circulationData || undefined} isLoading={isLoading} />
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Circulation Trends</CardTitle>
                <CardDescription>Borrowing trend overview (sample)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Week-over-week</span><Badge variant="outline">+12%</Badge></div>
                  <div className="flex justify-between"><span>Month-over-month</span><Badge variant="outline">+7%</Badge></div>
                  <div className="flex justify-between"><span>Overdue rate</span><Badge variant="outline">9%</Badge></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>Popular categories (sample)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Fiction</span><Badge variant="outline">42%</Badge></div>
                  <div className="flex justify-between"><span>Filipiniana</span><Badge variant="outline">25%</Badge></div>
                  <div className="flex justify-between"><span>Easy Books</span><Badge variant="outline">18%</Badge></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Popular Books</CardTitle>
                <CardDescription>Top titles (sample)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Fiction • Sample Book</span><Badge variant="outline">120</Badge></div>
                  <div className="flex justify-between"><span>Filipiniana • Heritage</span><Badge variant="outline">95</Badge></div>
                  <div className="flex justify-between"><span>Easy Books • ABCs</span><Badge variant="outline">60</Badge></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <EquipmentUtilizationAnalytics timeframe={selectedPeriod} data={equipmentData || undefined} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="fines" className="space-y-4">
          <FineCollectionAnalytics timeframe={selectedPeriod} data={finesData || undefined} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <PredictiveInsights insights={[]} timeframe={selectedPeriod} onTimeframeChange={setSelectedPeriod} onInsightAction={() => {}} />
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-4">
          <TimeSeriesForecast data={[]} metric={selectedMetric} timeframe={selectedPeriod} onMetricChange={setSelectedMetric} onTimeframeChange={setSelectedPeriod} />
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <UsageHeatMap data={[]} timeframe={selectedPeriod} />
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Breakdown of library activities</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={activityChartHeight}>
                  <PieChart>
                    <Pie data={(activityDistribution.length ? activityDistribution : categoryDistribution.length ? categoryDistribution : mockActivityData) as any} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                      {(activityDistribution.length ? activityDistribution : categoryDistribution.length ? categoryDistribution : mockActivityData).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || 'hsl(var(--primary))'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {(activityDistribution.length ? activityDistribution : categoryDistribution.length ? categoryDistribution : mockActivityData).map((entry: any, idx: number) => (
                    <div key={`legend-${idx}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: entry.color || 'hsl(var(--primary))' }} />
                        <span>{entry.name}</span>
                      </div>
                      <span className="text-muted-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Times</CardTitle>
                <CardDescription>Busiest hours and activities</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={activityChartHeight}>
                  <BarChart data={selectedPeriod === 'day'
                    ? (popularTimesDay.length ? popularTimesDay : currentUsageData)
                    : selectedPeriod === 'week'
                      ? (popularTimesWeek.length ? popularTimesWeek : currentUsageData)
                      : (popularTimesMonth.length ? popularTimesMonth : currentUsageData)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={selectedPeriod === 'month' ? 'week' : selectedPeriod === 'week' ? 'day' : 'time'} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="students" fill="hsl(var(--primary))" name="Students" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>Student usage by grade level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(gradeDistribution.length ? gradeDistribution : mockGradeDistribution).map((grade) => (
                    <div key={grade.grade} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{grade.grade}</span>
                        <span className="text-sm text-muted-foreground">{grade.students} students ({grade.percentage}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${grade.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time Limits by Grade</CardTitle>
                <CardDescription>Standard time limits for different grade levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded"><div><div className="font-medium">Primary (K-3)</div><div className="text-sm text-muted-foreground">Supervised activities</div></div><Badge variant="outline">15 min</Badge></div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded"><div><div className="font-medium">Grade School (4-6)</div><div className="text-sm text-muted-foreground">Basic computer access</div></div><Badge variant="outline">30 min</Badge></div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded"><div><div className="font-medium">Junior High (7-10)</div><div className="text-sm text-muted-foreground">Full access + gaming</div></div><Badge variant="outline">45 min</Badge></div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded"><div><div className="font-medium">Senior High (11-12)</div><div className="text-sm text-muted-foreground">Premium access</div></div><Badge variant="outline">60 min</Badge></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <AdvancedReporting />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between py-4 border-t">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1"><Clock className="h-4 w-4" />Last updated: {lastRefresh.toLocaleTimeString()}</div>
          <div className="flex items-center gap-1"><Activity className="h-4 w-4" />Auto-refresh: Manual</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{selectedPeriod === 'day' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}</Badge>
          <Badge variant={'secondary'} className="text-xs">{(liveMetrics && ((liveMetrics.totalBooks ?? 0) > 0 || (liveMetrics.studentsCount ?? 0) > 0)) ? 'Live Data' : 'Sample Data'}</Badge>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard
