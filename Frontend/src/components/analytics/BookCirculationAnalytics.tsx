import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import {
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  Filter,
  Download
} from 'lucide-react'

interface BookCirculationAnalyticsProps {
  timeframe: 'day' | 'week' | 'month'
  data?: any
  isLoading?: boolean
}

interface CirculationTrend {
  date: string
  borrowed: number
  returned: number
  overdue: number
}

interface CategoryData {
  category: string
  count: number
  percentage: number
  color: string
}

interface PopularBook {
  id: string
  title: string
  author: string
  category: string
  circulationCount: number
  popularity: number
  availableCopies: number
  totalCopies: number
  overdueCount?: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export function BookCirculationAnalytics({ timeframe, data, isLoading = false }: BookCirculationAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'categories' | 'popular'>('overview')
  const [circulationTrends, setCirculationTrends] = useState<CirculationTrend[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [popularBooks, setPopularBooks] = useState<PopularBook[]>([])

  useEffect(() => {
    if (data) {
      processCirculationData(data)
    }
  }, [data, timeframe])

  const processCirculationData = (analyticsData: any) => {
    // Process circulation trends
    const trends: CirculationTrend[] = generateMockTrends(timeframe)
    setCirculationTrends(trends)

    // Process category data
    const categories = analyticsData.circulationByCategory?.map((cat: any, index: number) => ({
      category: cat.category,
      count: cat.count,
      percentage: calculatePercentage(cat.count, analyticsData.totalCirculation),
      color: COLORS[index % COLORS.length]
    })) || []
    setCategoryData(categories)

    // Process popular books
    const books = analyticsData.mostBorrowedBooks?.map((book: any) => ({
      ...book,
      overdueCount: Math.floor(Math.random() * 5) // Mock overdue count
    })) || []
    setPopularBooks(books)
  }

  const generateMockTrends = (tf: string): CirculationTrend[] => {
    const dataPoints = tf === 'day' ? 24 : tf === 'week' ? 7 : 30
    const trends: CirculationTrend[] = []

    for (let i = 0; i < dataPoints; i++) {
      const baseValue = tf === 'day' ? 15 : tf === 'week' ? 100 : 400
      const variation = Math.random() * 0.4 - 0.2 // ±20% variation

      trends.push({
        date: tf === 'day' ? `${i}:00` : tf === 'week' ? (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] ?? `Day ${i}`) : `Day ${i + 1}`,
        borrowed: Math.round(baseValue * (1 + variation)),
        returned: Math.round(baseValue * 0.8 * (1 + variation * 0.5)),
        overdue: Math.round(baseValue * 0.1 * (1 + variation * 0.3))
      })
    }

    return trends
  }

  const calculatePercentage = (value: number, total: number): number => {
    return total > 0 ? Math.round((value / total) * 100) : 0
  }

  const getPopularityBadge = (popularity: number) => {
    if (popularity >= 80) return <Badge className="bg-green-500">High</Badge>
    if (popularity >= 50) return <Badge className="bg-yellow-500">Medium</Badge>
    return <Badge variant="outline">Low</Badge>
  }

  const CirculationOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Circulation</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCirculation || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.trends?.growthRate > 0 ? '+' : ''}{data?.trends?.growthRate?.toFixed(1) || 0}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circulation Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.circulation?.circulationRate?.toFixed(1) || 0}%</div>
            <Progress value={data?.circulation?.circulationRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.circulation?.returnRate?.toFixed(1) || 0}%</div>
            <Progress value={data?.circulation?.returnRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.circulation?.overdueRate?.toFixed(1) || 0}%</div>
            <Progress value={data?.circulation?.overdueRate || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Circulation Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Circulation Trends</CardTitle>
          <CardDescription>
            Book borrowing, returns, and overdue trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={circulationTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => timeframe === 'month' ? `Day ${value}` : value}
              />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="borrowed"
                stackId="1"
                stroke="#0088FE"
                fill="#0088FE"
                fillOpacity={0.6}
                name="Borrowed"
              />
              <Area
                type="monotone"
                dataKey="returned"
                stackId="2"
                stroke="#00C49F"
                fill="#00C49F"
                fillOpacity={0.6}
                name="Returned"
              />
              <Area
                type="monotone"
                dataKey="overdue"
                stackId="3"
                stroke="#FF8042"
                fill="#FF8042"
                fillOpacity={0.6}
                name="Overdue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )

  const CategoryAnalysis = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Category Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Circulation by Category</CardTitle>
          <CardDescription>
            Distribution of book circulation across categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }) => `${category} ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance</CardTitle>
          <CardDescription>
            Detailed statistics for each book category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.map((category) => (
              <div key={category.category} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{category.category}</span>
                  <span className="text-sm text-muted-foreground">
                    {category.count} books ({category.percentage}%)
                  </span>
                </div>
                <Progress value={category.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const PopularBooks = () => (
    <Card>
      <CardHeader>
        <CardTitle>Most Popular Books</CardTitle>
        <CardDescription>
          Top borrowed books with circulation statistics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {popularBooks.map((book, index) => (
            <div key={book.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-semibold">#{index + 1}</span>
                  <h4 className="font-medium">{book.title}</h4>
                  {getPopularityBadge(book.popularity)}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  by {book.author} • {book.category}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {book.circulationCount} circulations
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {book.availableCopies}/{book.totalCopies} available
                  </span>
                  {book.overdueCount && book.overdueCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      {book.overdueCount} overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{book.popularity}%</div>
                <div className="text-xs text-muted-foreground">popularity</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  const OverdueAnalysis = () => {
    const overdueData = data?.overdueAnalysis

    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Analysis</CardTitle>
            <CardDescription>
              Statistics and patterns for overdue books
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {overdueData?.totalOverdue || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Overdue</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {overdueData?.averageOverdueDays?.toFixed(1) || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Days Overdue</div>
                </div>
              </div>

              {/* Overdue by Category */}
              <div className="space-y-2">
                <h4 className="font-medium">Overdue by Category</h4>
                {overdueData?.overdueByCategory?.map((cat: any) => (
                  <div key={cat.category} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">{cat.category}</span>
                    <span className="text-sm font-medium">{cat.count} books ({cat.averageDays} days)</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>
              Automated suggestions to reduce overdue rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Automated Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Send email/SMS reminders 2 days before due date
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Grace Period Policy</p>
                  <p className="text-xs text-muted-foreground">
                    Implement 2-day grace period for first-time offenders
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Flexible Loan Periods</p>
                  <p className="text-xs text-muted-foreground">
                    Adjust loan periods based on book category and user history
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded animate-pulse"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Book Circulation Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive analysis of book borrowing patterns and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="popular">Popular Books</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CirculationOverview />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <CirculationOverview />
          <OverdueAnalysis />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <CategoryAnalysis />
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <PopularBooks />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default BookCirculationAnalytics
