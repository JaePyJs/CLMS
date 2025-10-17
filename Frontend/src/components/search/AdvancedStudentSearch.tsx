import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Users, Filter, X, Download, BookOpen, Monitor, AlertTriangle, Calendar, ChevronDown, UserCheck, UserX } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  fullName: string;
  grade_category: string;
  grade_level: string;
  section?: string;
  is_active: boolean;
  fine_balance: number;
  equipment_ban: boolean;
  equipment_ban_reason?: string;
  equipment_ban_until?: string;
  activeCheckouts: number;
  overdueCheckouts: number;
  totalActivities: number;
  lastActivityDate?: string;
  lastCheckoutDate?: string;
  currentEquipmentSession?: any;
  hasOverdueItems: boolean;
  equipmentBanStatus: {
    isBanned: boolean;
    reason?: string;
    until?: string;
  };
}

interface StudentSearchOptions {
  query?: string;
  gradeCategory?: string;
  gradeLevel?: string;
  isActive?: boolean;
  hasEquipmentBan?: boolean;
  hasFines?: boolean;
  activityType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'gradeLevel' | 'lastActivity' | 'fineBalance' | 'checkoutCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface StudentSearchResult {
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: StudentSearchOptions;
  sortBy: string;
  sortOrder: string;
}

interface StudentSuggestion {
  names: string[];
  studentIds: string[];
  grades: string[];
}

export default function AdvancedStudentSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<StudentSuggestion>({
    names: [],
    studentIds: [],
    grades: []
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [filters, setFilters] = useState<StudentSearchOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
    isActive: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch suggestions with debouncing
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions({ names: [], studentIds: [], grades: [] });
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await apiClient.get('/api/search/students/suggestions', {
        params: {
          query: searchQuery,
          limit: 5,
        },
      });

      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch student suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Debounced search input handler
  const handleSearchInput = (value: string) => {
    setQuery(value);
    setCurrentPage(1);

    // Clear existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Set new timeout for suggestions
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    if (value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Enhanced student search function
  const performSearch = async (page = 1, resetPagination = true) => {
    if (!query.trim() && !Object.keys(filters).some(key =>
      filters[key as keyof StudentSearchOptions] !== undefined &&
      filters[key as keyof StudentSearchOptions] !== ''
    )) {
      return;
    }

    setLoading(true);
    try {
      const searchParams: any = {
        page,
        limit: 20,
      };

      // Add filters to search params
      if (query) searchParams.query = query;
      if (filters.gradeCategory) searchParams.gradeCategory = filters.gradeCategory;
      if (filters.gradeLevel) searchParams.gradeLevel = filters.gradeLevel;
      if (filters.isActive !== undefined) searchParams.isActive = filters.isActive;
      if (filters.hasEquipmentBan !== undefined) searchParams.hasEquipmentBan = filters.hasEquipmentBan;
      if (filters.hasFines !== undefined) searchParams.hasFines = filters.hasFines;
      if (filters.activityType) searchParams.activityType = filters.activityType;
      if (filters.dateFrom) searchParams.dateFrom = filters.dateFrom;
      if (filters.dateTo) searchParams.dateTo = filters.dateTo;
      if (filters.sortBy) searchParams.sortBy = filters.sortBy;
      if (filters.sortOrder) searchParams.sortOrder = filters.sortOrder;

      const response = await apiClient.get('/api/search/students', { params: searchParams });

      if (response.success && response.data) {
        if (resetPagination) {
          setSearchResults(response.data);
        } else {
          // Append results for pagination
          setSearchResults(prev => ({
            ...response.data,
            students: [...(prev?.students || []), ...response.data.students],
          }));
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Student search error:', error);
      toast.error('Failed to perform student search');
    } finally {
      setLoading(false);
    }
  };

  // Load more results (pagination)
  const loadMore = () => {
    if (searchResults && currentPage < searchResults.pagination.pages) {
      performSearch(currentPage + 1, false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      sortBy: 'name',
      sortOrder: 'asc',
      isActive: true,
    });
    setQuery('');
    setCurrentPage(1);
    setSearchResults(null);
    setShowSuggestions(false);
  };

  // Apply suggestion
  const applySuggestion = (type: 'name' | 'studentId' | 'grade', value: string) => {
    setQuery(value);
    setShowSuggestions(false);

    // Update filters based on suggestion type
    if (type === 'studentId') {
      // Student ID search is more specific
      setFilters({ ...filters, query: value });
    } else if (type === 'grade') {
      setFilters({ ...filters, gradeLevel: value });
    }

    setCurrentPage(1);
    performSearch();
  };

  // Toggle student selection
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Export results
  const exportResults = () => {
    if (!searchResults) return;

    const data = searchResults.students.map(student => ({
      'Student ID': student.student_id,
      'Name': student.fullName,
      'Grade': student.grade_level,
      'Section': student.section || '',
      'Status': student.is_active ? 'Active' : 'Inactive',
      'Fine Balance': student.fine_balance,
      'Active Checkouts': student.activeCheckouts,
      'Overdue Items': student.overdueCheckouts,
      'Equipment Ban': student.equipment_ban ? 'Yes' : 'No',
      'Last Activity': student.lastActivityDate || 'Never',
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-search-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Student status badges
  const getStatusBadges = (student: Student) => {
    const badges = [];

    if (!student.is_active) {
      badges.push(<Badge key="inactive" variant="secondary">Inactive</Badge>);
    }

    if (student.equipment_ban) {
      badges.push(
        <Badge key="ban" variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Equipment Ban
        </Badge>
      );
    }

    if (student.hasOverdueItems) {
      badges.push(
        <Badge key="overdue" variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Overdue Items
        </Badge>
      );
    }

    if (student.fine_balance > 0) {
      badges.push(
        <Badge key="fines" variant="outline">
          ${student.fine_balance.toFixed(2)} Fines
        </Badge>
      );
    }

    if (student.activeCheckouts > 0) {
      badges.push(
        <Badge key="checkouts" variant="default">
          <BookOpen className="w-3 h-3 mr-1" />
          {student.activeCheckouts} Active
        </Badge>
      );
    }

    if (student.currentEquipmentSession) {
      badges.push(
        <Badge key="session" variant="default">
          <Monitor className="w-3 h-3 mr-1" />
          In Session
        </Badge>
      );
    }

    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Advanced Student Search
          </CardTitle>
          <CardDescription>
            Search and filter students by various criteria including grade, activity, and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar with Suggestions */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by name, student ID, or grade..."
                  value={query}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      performSearch();
                    }
                  }}
                  className="pl-10"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && (suggestions.names.length > 0 || suggestions.studentIds.length > 0 || suggestions.grades.length > 0) && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
                    <div className="p-2 space-y-2">
                      {suggestions.names.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Names</div>
                          {suggestions.names.map((name, index) => (
                            <div
                              key={`name-${index}`}
                              className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                              onClick={() => applySuggestion('name', name)}
                            >
                              <Users className="w-3 h-3 mr-2 inline" />
                              {name}
                            </div>
                          ))}
                        </div>
                      )}

                      {suggestions.studentIds.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Student IDs</div>
                          {suggestions.studentIds.map((studentId, index) => (
                            <div
                              key={`id-${index}`}
                              className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                              onClick={() => applySuggestion('studentId', studentId)}
                            >
                              <Users className="w-3 h-3 mr-2 inline" />
                              {studentId}
                            </div>
                          ))}
                        </div>
                      )}

                      {suggestions.grades.length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Grades</div>
                          {suggestions.grades.map((grade, index) => (
                            <div
                              key={`grade-${index}`}
                              className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                              onClick={() => applySuggestion('grade', grade)}
                            >
                              <Users className="w-3 h-3 mr-2 inline" />
                              {grade}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={() => performSearch()} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(filters.gradeCategory || filters.gradeLevel || filters.hasEquipmentBan || filters.hasFines) && (
                  <ChevronDown className="w-4 h-4 ml-2" />
                )}
              </Button>

              {searchResults && searchResults.students.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filters.isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilters({ ...filters, isActive: !filters.isActive });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                {filters.isActive ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                {filters.isActive ? 'Active' : 'Inactive'} Only
              </Button>

              <Button
                variant={filters.hasEquipmentBan ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilters({ ...filters, hasEquipmentBan: !filters.hasEquipmentBan });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Equipment Ban
              </Button>

              <Button
                variant={filters.hasFines ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilters({ ...filters, hasFines: !filters.hasFines });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                $ Fines
              </Button>

              <Select
                value={filters.sortBy}
                onValueChange={(value: any) => {
                  setFilters({ ...filters, sortBy: value });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="gradeLevel">Grade</SelectItem>
                  <SelectItem value="lastActivity">Last Activity</SelectItem>
                  <SelectItem value="fineBalance">Fine Balance</SelectItem>
                  <SelectItem value="checkoutCount">Checkouts</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.sortOrder}
                onValueChange={(value: any) => {
                  setFilters({ ...filters, sortOrder: value });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">A-Z</SelectItem>
                  <SelectItem value="desc">Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Grade Category</label>
                  <Select
                    value={filters.gradeCategory || ''}
                    onValueChange={(value: any) => {
                      setFilters({ ...filters, gradeCategory: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Categories</SelectItem>
                      <SelectItem value="PRIMARY">Primary</SelectItem>
                      <SelectItem value="GRADE_SCHOOL">Grade School</SelectItem>
                      <SelectItem value="JUNIOR_HIGH">Junior High</SelectItem>
                      <SelectItem value="SENIOR_HIGH">Senior High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Grade Level</label>
                  <Input
                    placeholder="Filter by grade..."
                    value={filters.gradeLevel || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, gradeLevel: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Activity Type</label>
                  <Select
                    value={filters.activityType || ''}
                    onValueChange={(value: any) => {
                      setFilters({ ...filters, activityType: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Activities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Activities</SelectItem>
                      <SelectItem value="COMPUTER_USE">Computer Use</SelectItem>
                      <SelectItem value="GAMING_SESSION">Gaming</SelectItem>
                      <SelectItem value="AVR_SESSION">AVR</SelectItem>
                      <SelectItem value="BOOK_CHECKOUT">Book Checkout</SelectItem>
                      <SelectItem value="GENERAL_VISIT">General Visit</SelectItem>
                      <SelectItem value="STUDY">Study</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date From</label>
                  <Input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, dateFrom: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date To</label>
                  <Input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, dateTo: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2 md:col-span-3 lg:col-span-5">
                  <label className="text-sm font-medium">Actions</label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                    {selectedStudents.length > 0 && (
                      <Badge variant="outline">
                        {selectedStudents.length} selected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Student Search Results</CardTitle>
                <CardDescription>
                  Found {searchResults.pagination.total} students
                  {query && ` for "${query}"`}
                  {filters.gradeLevel && ` in grade ${filters.gradeLevel}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {searchResults.pagination.total > 20 && (
                  <Badge variant="outline">
                    Page {searchResults.pagination.page} of {searchResults.pagination.pages}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedStudents.length === searchResults.students.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents(searchResults.students.map(s => s.id));
                          } else {
                            setSelectedStudents([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fines</TableHead>
                    <TableHead>Checkouts</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.fullName}</TableCell>
                      <TableCell>{student.student_id}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.grade_level}</div>
                          {student.section && (
                            <div className="text-sm text-muted-foreground">{student.section}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          {student.currentEquipmentSession && (
                            <Badge variant="outline" className="text-xs">
                              <Monitor className="w-3 h-3 mr-1" />
                              In Session
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.fine_balance > 0 ? (
                          <Badge variant="destructive">${student.fine_balance.toFixed(2)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{student.activeCheckouts} active</div>
                          {student.overdueCheckouts > 0 && (
                            <div className="text-xs text-destructive">
                              {student.overdueCheckouts} overdue
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.lastActivityDate && (
                            <div className="text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              {new Date(student.lastActivityDate).toLocaleDateString()}
                            </div>
                          )}
                          <div className="flex gap-1 flex-wrap">
                            {getStatusBadges(student)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Load More Button */}
            {searchResults.pagination.page < searchResults.pagination.pages && (
              <div className="flex justify-center mt-6 p-4">
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!searchResults && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">
              {query ? 'No results found' : 'Enter a search query to begin'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}