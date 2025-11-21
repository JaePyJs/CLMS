import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  TrendingUp,
  Users,
  Book,
  Clock,
  Award,
  Star,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { enhancedLibraryApi } from '@/lib/api';

interface TopUser {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  totalBooksBorrowed: number;
  totalDaysInLibrary: number;
  averageDuration: string;
  lastVisit: string;
  purposes: {
    AVR: number;
    Computer: number;
    'Library Space': number;
    Borrowing: number;
    Recreation: number;
  };
}

interface PopularBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  materialType: string;
  totalBorrowings: number;
  currentBorrowers: number;
  averageRating: number;
  lastBorrowed: string;
  coverImage?: string;
}

interface LibraryAnalytics {
  topUsers: TopUser[];
  popularBooks: PopularBook[];
  totalPatrons: number;
  totalBooksBorrowed: number;
  averageBooksPerPatron: number;
  mostPopularPurpose: string;
  busiestDay: string;
  averageLibraryTime: string;
}

export function LibraryAnalytics() {
  const [analytics, setAnalytics] = useState<LibraryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>(
    'month'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currentAbort = useRef<AbortController | null>(null);

  const fetchAnalytics = async () => {
    try {
      if (currentAbort.current) currentAbort.current.abort();
      const controller = new AbortController();
      currentAbort.current = controller;
      setLoading(true);
      const response = await enhancedLibraryApi.getLibraryAnalytics(timeRange);

      if (response.success && response.data) {
        setAnalytics(response.data);
      } else {
        toast.error('Failed to fetch analytics data');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAnalytics();
    setIsRefreshing(false);
    toast.success('Analytics refreshed');
  };

  const handleExportAnalytics = async () => {
    try {
      const response = await enhancedLibraryApi.exportAnalytics(timeRange);
      if (response.success && response.data) {
        // Create and download the file
        const blob = new Blob([response.data.content], {
          type: response.data.mimeType,
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Analytics report exported successfully');
      } else {
        toast.error('Failed to export analytics');
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast.error('Error exporting analytics report');
    }
  };

  const getTopPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'AVR':
        return '🎧';
      case 'Computer':
        return '💻';
      case 'Library Space':
        return '📚';
      case 'Borrowing':
        return '📖';
      case 'Recreation':
        return '🎮';
      default:
        return '📍';
    }
  };

  const getMaterialTypeColor = (type: string) => {
    const colors = {
      Filipiniana: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      Fiction: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Easy Books':
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      Reference:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      Textbook:
        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    let timeout: number | undefined;
    timeout = window.setTimeout(() => {
      void fetchAnalytics();
    }, 250);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      if (currentAbort.current) currentAbort.current.abort();
    };
  }, [timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Library Analytics
            </CardTitle>
            <CardDescription>
              Top users and popular books analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Library Analytics
            </CardTitle>
            <CardDescription>No analytics data available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No analytics data available for the selected time range.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Library Analytics
              </CardTitle>
              <CardDescription>
                Insights into library usage and popular resources
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) =>
                  setTimeRange(e.target.value as 'week' | 'month' | 'year')
                }
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAnalytics}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Total Patrons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {analytics.totalPatrons}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              active library users
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
              Books Borrowed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {analytics.totalBooksBorrowed}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              total borrowings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Avg Books/Patron
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {analytics.averageBooksPerPatron.toFixed(1)}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              books per student
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Popular Purpose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
              {getTopPurposeIcon(analytics.mostPopularPurpose)}{' '}
              {analytics.mostPopularPurpose}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              most visited area
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Library Users
          </CardTitle>
          <CardDescription>Most active patrons in the library</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.topUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No user activity data available for this time period.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.topUsers.map((user, index) => (
                <Card
                  key={user.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              index === 0
                                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                                : index === 1
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-500'
                                  : index === 2
                                    ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                            }`}
                          >
                            <span className="text-white font-bold text-lg">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{user.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {user.studentId} • {user.gradeLevel}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              <Book className="h-3 w-3 mr-1" />
                              {user.totalBooksBorrowed} books
                            </Badge>
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {user.averageDuration}
                            </Badge>
                            <Badge variant="outline">
                              <Calendar className="h-3 w-3 mr-1" />
                              {user.totalDaysInLibrary} days
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground mb-2">
                          Last visit:{' '}
                          {new Date(user.lastVisit).toLocaleDateString()}
                        </div>
                        <div className="flex gap-1">
                          {Object.entries(user.purposes).map(
                            ([purpose, count]) =>
                              count > 0 && (
                                <Badge
                                  key={purpose}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {getTopPurposeIcon(purpose)} {count}
                                </Badge>
                              )
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Popular Books */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Most Popular Books
          </CardTitle>
          <CardDescription>
            Books with the highest borrowing frequency
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.popularBooks.length === 0 ? (
            <div className="text-center py-12">
              <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No book borrowing data available for this time period.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.popularBooks.map((book) => (
                <Card
                  key={book.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {book.coverImage ? (
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            className="w-16 h-20 object-cover rounded-md"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                            <Book className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {book.title}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          by {book.author}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            className={getMaterialTypeColor(book.materialType)}
                          >
                            {book.materialType}
                          </Badge>
                          <Badge variant="outline">ISBN: {book.isbn}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="default">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {book.totalBorrowings} borrowings
                          </Badge>
                          <Badge variant="outline">
                            <Users className="h-3 w-3 mr-1" />
                            {book.currentBorrowers} current
                          </Badge>
                        </div>
                        {book.averageRating > 0 && (
                          <div className="flex items-center mt-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < Math.floor(book.averageRating)
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-muted-foreground'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-muted-foreground ml-2">
                              {book.averageRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Last borrowed:{' '}
                          {new Date(book.lastBorrowed).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
