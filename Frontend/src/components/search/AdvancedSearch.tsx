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
  metadata: Record<string, unknown>;
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
    // Load _search history from localStorage
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

      // _Search Books
      if (filters.type === 'all' || filters.type === 'book') {
        const booksResponse = await apiClient.get('/api/books', {
          _search: query,
          category: filters.category,
        });

        if (booksResponse.success && booksResponse.data) {
          const data = booksResponse.data as unknown;
          const books = Array.isArray(data)
            ? data
            : (data as { books?: unknown[] }).books || [];
          books.forEach((book: unknown) => {
            const b = book as Record<string, unknown>;
            if (
              String(b.title || '')
                .toLowerCase()
                .includes(query.toLowerCase()) ||
              String(b.author || '')
                .toLowerCase()
                .includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'book',
                id: String(b.id),
                title: String(b.title),
                subtitle: `by ${String(b.author)} • ${String(b.category)}`,
                metadata: b,
              });
            }
          });
        }
      }

      // _Search Students
      if (filters.type === 'all' || filters.type === 'student') {
        const studentsResponse = await apiClient.get('/api/students');

        if (studentsResponse.success && studentsResponse.data) {
          const data = studentsResponse.data as unknown;
          const students = Array.isArray(data)
            ? data
            : (data as { students?: unknown[] }).students || [];
          students.forEach((student: unknown) => {
            const s = student as Record<string, unknown>;
            const fullName =
              `${String(s.firstName)} ${String(s.lastName)}`.toLowerCase();
            if (
              fullName.includes(query.toLowerCase()) ||
              String(s.studentId || '')
                .toLowerCase()
                .includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'student',
                id: String(s.id),
                title: `${String(s.firstName)} ${String(s.lastName)}`,
                subtitle: `${String(s.studentId)} • ${String(s.gradeLevel)}`,
                metadata: s,
              });
            }
          });
        }
      }

      // _Search Activities
      if (filters.type === 'all' || filters.type === 'activity') {
        const activitiesResponse = await apiClient.get('/api/activities', {
          limit: 50,
        });

        if (activitiesResponse.success && activitiesResponse.data) {
          const data = activitiesResponse.data as unknown;
          const activities = Array.isArray(data)
            ? data
            : (data as { activities?: unknown[] }).activities || [];
          activities.forEach((activity: unknown) => {
            const a = activity as Record<string, unknown>;
            if (
              String(a.studentName || '')
                .toLowerCase()
                .includes(query.toLowerCase())
            ) {
              searchResults.push({
                type: 'activity',
                id: String(a.id),
                title: String(a.studentName) || 'Unknown Student',
                subtitle: `${String(a.activityType)} • ${new Date(a.startTime as string).toLocaleDateString()}`,
                metadata: a,
              });
            }
          });
        }
      }

      setResults(searchResults);

      // Add to _search history
      const newHistory = [
        query,
        ...searchHistory.filter((h) => h !== query),
      ].slice(0, 10);
      setSearchHistory(newHistory);
      localStorage.setItem('clms_search_history', JSON.stringify(newHistory));
    } catch (error) {
      console.error('_Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = () => {
    const name = prompt('Enter a name for this _search:');
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

  const loadSavedSearch = (_search: SavedSearch) => {
    setQuery(_search.query);
    setFilters(_search.filters);
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
      `_search-results-${new Date().toISOString().split('T')[0]}`
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
            Advanced _Search
          </CardTitle>
          <CardDescription>
            _Search across books, students, and activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* _Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="_Search for books, students, or activities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={performSearch} disabled={loading}>
              {loading ? 'Searching...' : '_Search'}
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
                    onValueChange={(value: string) =>
                      setFilters({
                        ...filters,
                        type: value as 'all' | 'book' | 'student' | 'activity',
                      })
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
                  {query
                    ? 'No results found'
                    : 'Enter a _search query to begin'}
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
                  No _search history
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
                  {savedSearches.map((_search) => (
                    <div
                      key={_search.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{_search.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {_search.query} • {_search.filters.type}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadSavedSearch(_search)}
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSavedSearch(_search.id)}
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
