import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Clock,
  MapPin,
  Search,
  RefreshCw,
  CheckCircle,
  User,
  BookOpen,
  Monitor,
  Headphones,
  Gamepad2,
} from 'lucide-react';
import { toast } from 'sonner';
import { enhancedLibraryApi } from '@/lib/api';

interface PatronActivity {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  purpose: 'AVR' | 'Computer' | 'Library Space' | 'Borrowing' | 'Recreation';
  checkInTime: string;
  location?: string;
  status: 'active' | 'completed';
}

interface UserTrackingStats {
  totalPatrons: number;
  activePatrons: number;
  avgDuration: string;
  topPurpose: string;
}

export function UserTracking() {
  const [patrons, setPatrons] = useState<PatronActivity[]>([]);
  const [stats, setStats] = useState<UserTrackingStats>({
    totalPatrons: 0,
    activePatrons: 0,
    avgDuration: '0 min',
    topPurpose: 'None',
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const purposeIcons = {
    AVR: Headphones,
    Computer: Monitor,
    'Library Space': BookOpen,
    Borrowing: BookOpen,
    Recreation: Gamepad2,
  };

  const purposeColors = {
    AVR: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    Computer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'Library Space':
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    Borrowing:
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    Recreation: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  };

  const fetchPatrons = async () => {
    try {
      setLoading(true);
      const response = await enhancedLibraryApi.getCurrentPatrons();

      if (response.success && response.data) {
        const dd: any = response.data || {};
        const patrons = dd.patrons || [];

        // Use real data only - no mock data
        setPatrons(patrons);

        const ds: any = dd.stats || {};
        setStats({
          totalPatrons: Number(ds.totalPatrons || 0),
          activePatrons: Number(ds.activePatrons || 0),
          avgDuration: String(ds.avgDuration || '0 min'),
          topPurpose: String(ds.topPurpose || 'None'),
        });
      } else {
        // Show error if API fails
        const errMsg =
          typeof (response as any)?.error === 'string'
            ? (response as any).error
            : (response as any)?.error?.message ||
              'Failed to fetch patron data';
        toast.error(String(errMsg));

        // Set empty data on error
        setPatrons([]);
        setStats({
          totalPatrons: 0,
          activePatrons: 0,
          avgDuration: '0 min',
          topPurpose: 'None',
        });
      }
    } catch (error) {
      console.error('Error fetching patrons:', error);
      const msg = (error as any)?.message || 'Error loading patron data';
      toast.error(String(msg));

      // Set empty data on error
      setPatrons([]);
      setStats({
        totalPatrons: 0,
        activePatrons: 0,
        avgDuration: '0 min',
        topPurpose: 'None',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPatrons();
    setIsRefreshing(false);
    toast.success('Patron data refreshed');
  };

  const handleManualCheckout = async (patronId: string) => {
    try {
      const response = await enhancedLibraryApi.checkoutPatron(patronId);
      if (response.success) {
        toast.success('Patron checked out successfully');
        await fetchPatrons();
      } else {
        const errMsg =
          typeof (response as any)?.error === 'string'
            ? (response as any).error
            : (response as any)?.error?.message || 'Failed to checkout patron';
        toast.error(String(errMsg));
      }
    } catch (error) {
      console.error('Error checking out patron:', error);
      const msg = (error as any)?.message || 'Error checking out patron';
      toast.error(String(msg));
    }
  };

  const getDuration = (checkInTime: string) => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diffMs = now.getTime() - checkIn.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const filteredPatrons = patrons.filter((patron) => {
    const matchesSearch =
      (patron.studentName || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (patron.studentId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPurpose =
      purposeFilter === 'all' || patron.purpose === purposeFilter;
    const matchesGrade =
      gradeFilter === 'all' || patron.gradeLevel === gradeFilter;

    return (
      matchesSearch &&
      matchesPurpose &&
      matchesGrade &&
      patron.status === 'active'
    );
  });

  useEffect(() => {
    fetchPatrons();
    const interval = setInterval(fetchPatrons, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Tracking
            </CardTitle>
            <CardDescription>Real-time patron monitoring</CardDescription>
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

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Total Patrons Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {stats.totalPatrons}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">
              Currently Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {stats.activePatrons}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Average Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {stats.avgDuration}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Top Purpose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
              {stats.topPurpose}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Current Patrons ({filteredPatrons.length})
              </CardTitle>
              <CardDescription>
                Real-time patron activity monitoring
              </CardDescription>
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Purposes</option>
              <option value="AVR">AVR</option>
              <option value="Computer">Computer</option>
              <option value="Library Space">Library Space</option>
              <option value="Borrowing">Borrowing</option>
              <option value="Recreation">Recreation</option>
            </select>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Grades</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>

          {/* Patrons List */}
          {filteredPatrons.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || purposeFilter !== 'all' || gradeFilter !== 'all'
                  ? 'No patrons match your filters'
                  : 'No active patrons in the library'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPatrons.map((patron) => {
                const IconComponent = purposeIcons[patron.purpose];
                const duration = getDuration(patron.checkInTime);

                return (
                  <Card
                    key={patron.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {patron.studentName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              ID: {patron.studentId} • {patron.gradeLevel}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={purposeColors[patron.purpose]}>
                                <IconComponent className="h-3 w-3 mr-1" />
                                {patron.purpose}
                              </Badge>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                {duration}
                              </div>
                              {patron.location && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {patron.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleManualCheckout(patron.id)}
                          >
                            Checkout
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
