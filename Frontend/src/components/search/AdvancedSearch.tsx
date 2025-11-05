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
import {
  Search,
  BookOpen,
  Users,
  Activity,
  Filter,
  History as HistoryIcon,
  Star,
  X,
  Download,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { downloadCSV } from '@/lib/export-utils';

interface SearchResult {
  type: 'book' | 'student' | 'activity';
  id: string;
  title: string;
  subtitle: string;
  metadata: any;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
}

interface SearchFilters {
  type: 'all' | 'book' | 'student' | 'activity';
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  category?: string;
  gradeLevel?: string;
}

export default function AdvancedSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ type: 'all' });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Load search history from localStorage
    const history = localStorage.getItem('clms_search_history');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }

    // Load saved searches
    const saved = localStorage.getItem('clms_saved_searches');
    if (saved) {
      setSavedSearches(JSON.parse(saved));
    }
  }, []);

  const performSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search Books
      if (filters.type === 'all' || filters.type === 'book') {
        const booksResponse = await apiClient.get('/api/books', {
          search: query,
          category: filters.category,
        });

        if (booksResponse.success && booksResponse.data) {
          const data = booksResponse.data as any;
          const books = Array.isArray(data) ? data : data.books || [];
          books.forEach((book: any) => {
            if (
              book.title?.toLowerCase().includes(query.toLowerCase()) ||
              book.author?.toLowerCase().includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'book',
                id: book.id,
                title: book.title,
                subtitle: `by ${book.author} • ${book.category}`,
                metadata: book,
              });
            }
          });
        }
      }

      // Search Students
      if (filters.type === 'all' || filters.type === 'student') {
        const studentsResponse = await apiClient.get('/api/students');

        if (studentsResponse.success && studentsResponse.data) {
          const data = studentsResponse.data as any;
          const students = Array.isArray(data) ? data : data.students || [];
          students.forEach((student: any) => {
            const fullName =
              `${student.firstName} ${student.lastName}`.toLowerCase();
            if (
              fullName.includes(query.toLowerCase()) ||
              student.studentId?.toLowerCase().includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'student',
                id: student.id,
                title: `${student.firstName} ${student.lastName}`,
                subtitle: `${student.studentId} • ${student.gradeLevel}`,
                metadata: student,
              });
            }
          });
        }
      }

      // Search Activities
      if (filters.type === 'all' || filters.type === 'activity') {
        const activitiesResponse = await apiClient.get('/api/activities', {
          limit: 50,
        });

        if (activitiesResponse.success && activitiesResponse.data) {
          const data = activitiesResponse.data as any;
          const activities = Array.isArray(data) ? data : data.activities || [];
          activities.forEach((activity: any) => {
            if (
              activity.studentName?.toLowerCase().includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'activity',
                id: activity.id,
                title: activity.studentName || 'Unknown Student',
                subtitle: `${activity.activityType} • ${new Date(activity.startTime).toLocaleDateString()}`,
                metadata: activity,
              });
            }
          });
        }
      }

      setResults(searchResults);

      // Add to search history
      const newHistory = [
        query,
        ...searchHistory.filter((h) => h !== query),
      ].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('clms_search_history', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = () => {
    const name = prompt('Enter a name for this search:');
    if (!name) {
      return;
    }

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      query,
      filters: { ...filters },
      createdAt: new Date(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    localStorage.setItem('clms_saved_searches', JSON.stringify(updated));
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setFilters(search.filters);
    performSearch();
  };

  const deleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('clms_saved_searches', JSON.stringify(updated));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('clms_search_history');
  };

  const exportResults = () => {
    const data = results.map((r) => ({
      Type: r.type,
      Title: r.title,
      Details: r.subtitle,
    }));
    downloadCSV(
      data,
      `search-results-${new Date().toISOString().split('T')[0]}`
    );
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'book':
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'student':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'activity':
        return <Activity className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Advanced Search
          </CardTitle>
          <CardDescription>
            Search across books, students, and activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search for books, students, or activities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={performSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={exportResults}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>

          {/* Filters */}
          {showFilters && (
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={filters.type}
                    onValueChange={(value: any) =>
                      setFilters({ ...filters, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="book">Books</SelectItem>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="activity">Activities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date From</label>
                  <Input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, dateFrom: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date To</label>
                  <Input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, dateTo: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Actions</label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({ type: 'all' })}
                    >
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={saveSearch}>
                      <Star className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Results and History Tabs */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results">Results ({results.length})</TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Star className="w-4 h-4 mr-2" />
            Saved Searches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          {results.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={`${result.type}-${result.id}`}>
                        <TableCell>{getResultIcon(result.type)}</TableCell>
                        <TableCell className="font-medium">
                          {result.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {result.subtitle}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">
                  {query ? 'No results found' : 'Enter a search query to begin'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Searches</CardTitle>
                {searchHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory}>
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {searchHistory.length > 0 ? (
                <div className="space-y-2">
                  {searchHistory.map((term, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setQuery(term);
                        performSearch();
                      }}
                    >
                      <span className="text-sm">{term}</span>
                      <HistoryIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No search history
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved">
          <Card>
            <CardHeader>
              <CardTitle>Saved Searches</CardTitle>
            </CardHeader>
            <CardContent>
              {savedSearches.length > 0 ? (
                <div className="space-y-2">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{search.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {search.query} • {search.filters.type}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadSavedSearch(search)}
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSavedSearch(search.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No saved searches
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
