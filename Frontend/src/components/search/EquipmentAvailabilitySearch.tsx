import { useState, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Monitor,
  Filter,
  X,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  ChevronDown,
  Zap,
  Settings,
  MapPin,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
  type: string;
  status: string;
  location: string;
  category?: string;
  requires_supervision: boolean;
  condition_rating: string;
  total_usage_hours: number;
  daily_usage_hours: number;
  max_time_minutes: number;
  currentSession?: Record<string, unknown>;
  upcomingReservation?: Record<string, unknown>;
  pendingMaintenance?: Record<string, unknown>;
  utilizationRate: number;
  recentUsageStats: {
    totalSessions: number;
    totalMinutes: number;
  };
  availabilityStatus: string;
  isReservationRequired: boolean;
  nextAvailableDate?: string;
  qr_code_data?: string;
  purchase_date?: string;
  warranty_expiry?: string;
}

interface EquipmentSearchOptions {
  query?: string;
  type?: string;
  status?: string;
  location?: string;
  category?: string;
  isAvailable?: boolean;
  requiresSupervision?: boolean;
  maintenanceDue?: boolean;
  conditionRating?: string;
  minUsageHours?: number;
  maxUsageHours?: number;
  sortBy?: 'name' | 'type' | 'status' | 'usageHours' | 'condition' | 'location';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface EquipmentSearchResult {
  equipment: Equipment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: EquipmentSearchOptions;
  sortBy: string;
  sortOrder: string;
}

interface EquipmentSuggestion {
  names: string[];
  types: string[];
  locations: string[];
}

export default function EquipmentAvailabilitySearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EquipmentSuggestion>({
    names: [],
    types: [],
    locations: [],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] =
    useState<EquipmentSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<EquipmentSearchOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Fetch suggestions with debouncing
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions({ names: [], types: [], locations: [] });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.get(
        '/api/_search/equipment/suggestions',
        {
          params: {
            query: searchQuery,
            limit: 5,
          },
        }
      );

      if (response.success && response.data) {
        setSuggestions(response.data as EquipmentSuggestion);
      }
    } catch (error) {
      console.error('Failed to fetch equipment suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced _search input handler
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

  // Enhanced equipment _search function
  const performSearch = async (page = 1, resetPagination = true) => {
    if (
      !query.trim() &&
      !Object.keys(filters).some(
        (key) =>
          filters[key as keyof EquipmentSearchOptions] !== undefined &&
          filters[key as keyof EquipmentSearchOptions] !== ''
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // Build query params
      const searchParams: Record<string, unknown> = {
        page,
        limit: 20,
      };

      // Add filters to _search params
      if (query) {
        searchParams.query = query;
      }
      if (filters.type) {
        searchParams.type = filters.type;
      }
      if (filters.status) {
        searchParams.status = filters.status;
      }
      if (filters.location) {
        searchParams.location = filters.location;
      }
      if (filters.category) {
        searchParams.category = filters.category;
      }
      if (filters.isAvailable !== undefined) {
        searchParams.isAvailable = filters.isAvailable;
      }
      if (filters.requiresSupervision !== undefined) {
        searchParams.requiresSupervision = filters.requiresSupervision;
      }
      if (filters.maintenanceDue !== undefined) {
        searchParams.maintenanceDue = filters.maintenanceDue;
      }
      if (filters.conditionRating) {
        searchParams.conditionRating = filters.conditionRating;
      }
      if (filters.minUsageHours !== undefined) {
        searchParams.minUsageHours = filters.minUsageHours;
      }
      if (filters.maxUsageHours !== undefined) {
        searchParams.maxUsageHours = filters.maxUsageHours;
      }
      if (filters.sortBy) {
        searchParams.sortBy = filters.sortBy;
      }
      if (filters.sortOrder) {
        searchParams.sortOrder = filters.sortOrder;
      }

      const response = await apiClient.get('/api/_search/equipment', {
        params: searchParams,
      });

      if (response.success && response.data) {
        if (resetPagination) {
          setSearchResults(response.data as EquipmentSearchResult);
        } else {
          // Append results for pagination
          setSearchResults((prev) => ({
            ...(response.data as EquipmentSearchResult),
            equipment: [
              ...(prev?.equipment || []),
              ...(response.data as EquipmentSearchResult).equipment,
            ],
          }));
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Equipment _search error:', error);
      toast.error('Failed to perform equipment _search');
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
    });
    setQuery('');
    setCurrentPage(1);
    setSearchResults(null);
    setShowSuggestions(false);
  };

  // Apply suggestion
  const applySuggestion = (
    type: 'name' | 'type' | 'location',
    value: string
  ) => {
    setQuery(value);
    setShowSuggestions(false);

    // Update filters based on suggestion type
    if (type === 'type') {
      setFilters({ ...filters, type: value });
    } else if (type === 'location') {
      setFilters({ ...filters, location: value });
    }

    setCurrentPage(1);
    performSearch();
  };

  // Toggle equipment selection
  const toggleEquipmentSelection = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId)
        ? prev.filter((id) => id !== equipmentId)
        : [...prev, equipmentId]
    );
  };

  // Export results
  const exportResults = () => {
    if (!searchResults || searchResults.equipment.length === 0) {
      return;
    }

    const data = searchResults.equipment.map((equipment) => ({
      'Equipment ID': equipment.equipment_id,
      Name: equipment.name,
      Type: equipment.type,
      Location: equipment.location,
      Status: equipment.status,
      Condition: equipment.condition_rating,
      'Usage Hours': equipment.total_usage_hours.toFixed(1),
      'Utilization Rate': `${equipment.utilizationRate.toFixed(1)}%`,
      'Sessions (30d)': equipment.recentUsageStats.totalSessions,
      'Max Session': `${equipment.max_time_minutes} min`,
      Supervision: equipment.requires_supervision ? 'Required' : 'Not Required',
      'Next Available': equipment.nextAvailableDate || 'Available Now',
    }));

    const csvRows = [Object.keys(data[0] || {}).join(',')];
    data.forEach((row) => {
      const values: string[] = [];
      Object.keys(row).forEach((key) => {
        const value = row[key as keyof typeof row];
        values.push(`"${String(value ?? '')}"`);
      });
      csvRows.push(values.join(','));
    });
    const csv = csvRows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-_search-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get status badge for equipment
  const getStatusBadge = (equipment: Equipment) => {
    switch (equipment.status) {
      case 'AVAILABLE':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Available
          </Badge>
        );
      case 'IN_USE':
        return (
          <Badge className="bg-blue-500">
            <Users className="w-3 h-3 mr-1" />
            In Use
          </Badge>
        );
      case 'MAINTENANCE':
        return (
          <Badge className="bg-orange-500">
            <Settings className="w-3 h-3 mr-1" />
            Maintenance
          </Badge>
        );
      case 'OUT_OF_ORDER':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Out of Order
          </Badge>
        );
      case 'RESERVED':
        return (
          <Badge className="bg-purple-500">
            <Calendar className="w-3 h-3 mr-1" />
            Reserved
          </Badge>
        );
      case 'RETIRED':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Retired
          </Badge>
        );
      default:
        return <Badge variant="outline">{equipment.status}</Badge>;
    }
  };

  // Get condition rating badge
  const getConditionBadge = (condition: string) => {
    const colors: Record<string, string> = {
      EXCELLENT: 'bg-green-500',
      GOOD: 'bg-blue-500',
      FAIR: 'bg-yellow-500',
      POOR: 'bg-orange-500',
      DAMAGED: 'bg-red-500',
    };

    return (
      <Badge className={colors[condition] || 'bg-gray-500'}>{condition}</Badge>
    );
  };

  // Get utilization rate badge
  const getUtilizationBadge = (rate: number) => {
    if (rate >= 80) {
      return (
        <Badge className="bg-red-500">
          <Zap className="w-3 h-3 mr-1" />
          High Usage
        </Badge>
      );
    } else if (rate >= 50) {
      return (
        <Badge className="bg-orange-500">
          <Zap className="w-3 h-3 mr-1" />
          Moderate
        </Badge>
      );
    } else if (rate >= 20) {
      return (
        <Badge className="bg-green-500">
          <Zap className="w-3 h-3 mr-1" />
          Low Usage
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Zap className="w-3 h-3 mr-1" />
        Minimal
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* _Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Equipment Availability _Search
          </CardTitle>
          <CardDescription>
            _Search and filter equipment by type, location, availability, and
            usage statistics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* _Search Bar with Suggestions */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search by name, equipment ID, type, or location..."
                  value={query}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false);
                      performSearch();
                    }
                  }}
                  className="pl-10"
                />

                {/* Suggestions Dropdown */}
                {showSuggestions &&
                  (suggestions.names.length > 0 ||
                    suggestions.types.length > 0 ||
                    suggestions.locations.length > 0) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
                      <div className="p-2 space-y-2">
                        {suggestions.names.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Equipment Names
                            </div>
                            {suggestions.names.map((name, index) => (
                              <div
                                key={`name-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() => applySuggestion('name', name)}
                              >
                                <Monitor className="w-3 h-3 mr-2 inline" />
                                {name}
                              </div>
                            ))}
                          </div>
                        )}

                        {suggestions.types.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Types
                            </div>
                            {suggestions.types.map((type, index) => (
                              <div
                                key={`type-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() => applySuggestion('type', type)}
                              >
                                <Monitor className="w-3 h-3 mr-2 inline" />
                                {type}
                              </div>
                            ))}
                          </div>
                        )}

                        {suggestions.locations.length > 0 && (
                          <div>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                              Locations
                            </div>
                            {suggestions.locations.map((location, index) => (
                              <div
                                key={`location-${index}`}
                                className="px-2 py-1 text-sm hover:bg-accent cursor-pointer rounded"
                                onClick={() =>
                                  applySuggestion('location', location)
                                }
                              >
                                <MapPin className="w-3 h-3 mr-2 inline" />
                                {location}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <Button onClick={() => performSearch()} disabled={loading}>
                {loading ? 'Searching...' : '_Search'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(filters.type ||
                  filters.status ||
                  filters.location ||
                  filters.isAvailable) && (
                  <ChevronDown className="w-4 h-4 ml-2" />
                )}
              </Button>

              {searchResults && searchResults.equipment.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filters.isAvailable ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilters({ ...filters, isAvailable: !filters.isAvailable });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Available Only
              </Button>

              <Button
                variant={filters.maintenanceDue ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilters({
                    ...filters,
                    maintenanceDue: !filters.maintenanceDue,
                  });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <Settings className="w-3 h-3 mr-1" />
                Maintenance Due
              </Button>

              <Button
                variant={filters.requiresSupervision ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFilters({
                    ...filters,
                    requiresSupervision: !filters.requiresSupervision,
                  });
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <UserCheck className="w-3 h-3 mr-1" />
                Supervision Required
              </Button>

              <Select
                value={filters.sortBy || ''}
                onValueChange={(value: string) => {
                  const sortBy = value as
                    | 'name'
                    | 'type'
                    | 'status'
                    | 'usageHours'
                    | 'condition'
                    | 'location';
                  const newFilters = { ...filters };
                  if (value) {
                    newFilters.sortBy = sortBy;
                  } else {
                    delete newFilters.sortBy;
                  }
                  setFilters(newFilters);
                  setCurrentPage(1);
                  performSearch();
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="usageHours">Usage Hours</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.sortOrder || ''}
                onValueChange={(value: string) => {
                  const sortOrder = value as 'asc' | 'desc';
                  const newFilters = { ...filters };
                  if (value) {
                    newFilters.sortOrder = sortOrder;
                  } else {
                    delete newFilters.sortOrder;
                  }
                  setFilters(newFilters);
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
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={filters.type || ''}
                    onValueChange={(value: string) => {
                      setFilters({ ...filters, type: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Types</SelectItem>
                      <SelectItem value="COMPUTER">Computer</SelectItem>
                      <SelectItem value="GAMING">Gaming</SelectItem>
                      <SelectItem value="AVR">AVR</SelectItem>
                      <SelectItem value="PRINTER">Printer</SelectItem>
                      <SelectItem value="SCANNER">Scanner</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={filters.status || ''}
                    onValueChange={(value: string) => {
                      setFilters({ ...filters, status: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="AVAILABLE">Available</SelectItem>
                      <SelectItem value="IN_USE">In Use</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
                      <SelectItem value="RESERVED">Reserved</SelectItem>
                      <SelectItem value="RETIRED">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    placeholder="Filter by location..."
                    value={filters.location || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, location: e.target.value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Condition</label>
                  <Select
                    value={filters.conditionRating || ''}
                    onValueChange={(value: string) => {
                      setFilters({ ...filters, conditionRating: value });
                      setCurrentPage(1);
                      performSearch();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Conditions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Conditions</SelectItem>
                      <SelectItem value="EXCELLENT">Excellent</SelectItem>
                      <SelectItem value="GOOD">Good</SelectItem>
                      <SelectItem value="FAIR">Fair</SelectItem>
                      <SelectItem value="POOR">Poor</SelectItem>
                      <SelectItem value="DAMAGED">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Usage Hours</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minUsageHours || ''}
                    onChange={(e) => {
                      const minUsageHours = e.target.value
                        ? parseInt(e.target.value)
                        : undefined;
                      const newFilters = { ...filters };
                      if (minUsageHours !== undefined) {
                        newFilters.minUsageHours = minUsageHours;
                      } else {
                        delete newFilters.minUsageHours;
                      }
                      setFilters(newFilters);
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Usage Hours</label>
                  <Input
                    type="number"
                    placeholder="9999"
                    value={filters.maxUsageHours || ''}
                    onChange={(e) => {
                      const maxUsageHours = e.target.value
                        ? parseInt(e.target.value)
                        : undefined;
                      const newFilters = { ...filters };
                      if (maxUsageHours !== undefined) {
                        newFilters.maxUsageHours = maxUsageHours;
                      } else {
                        delete newFilters.maxUsageHours;
                      }
                      setFilters(newFilters);
                      setCurrentPage(1);
                      performSearch();
                    }}
                  />
                </div>

                <div className="space-y-2 md:col-span-3 lg:col-span-6">
                  <label className="text-sm font-medium">Actions</label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                    {selectedEquipment.length > 0 && (
                      <Badge variant="outline">
                        {selectedEquipment.length} selected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* _Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Equipment _Search Results</CardTitle>
                <CardDescription>
                  Found {searchResults.pagination.total} equipment items
                  {query && ` for "${query}"`}
                  {filters.type && ` of type ${filters.type}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {searchResults.pagination.total > 20 && (
                  <Badge variant="outline">
                    Page {searchResults.pagination.page} of{' '}
                    {searchResults.pagination.pages}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={clearFilters}>
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
                        checked={
                          selectedEquipment.length ===
                          searchResults.equipment.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEquipment(
                              searchResults.equipment.map((e) => e.id)
                            );
                          } else {
                            setSelectedEquipment([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Next Available</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.equipment.map((equipment) => (
                    <TableRow key={equipment.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedEquipment.includes(equipment.id)}
                          onChange={() =>
                            toggleEquipmentSelection(equipment.id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{equipment.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {equipment.equipment_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{equipment.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {equipment.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(equipment)}
                          {equipment.requires_supervision && (
                            <Badge variant="outline" className="text-xs">
                              <UserCheck className="w-3 h-3 mr-1" />
                              Supervision Required
                            </Badge>
                          )}
                          {equipment.isReservationRequired && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              Reserved
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getConditionBadge(equipment.condition_rating)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span className="text-sm">
                              {equipment.total_usage_hours.toFixed(1)}h total
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getUtilizationBadge(equipment.utilizationRate)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {equipment.recentUsageStats.totalSessions} sessions
                            (30d)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {equipment.nextAvailableDate ? (
                            <div>
                              <div>
                                {new Date(
                                  equipment.nextAvailableDate
                                ).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(
                                  equipment.nextAvailableDate
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          ) : (
                            <Badge className="bg-green-500">
                              Available Now
                            </Badge>
                          )}
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
                <Button onClick={loadMore} disabled={loading} variant="outline">
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
              {query ? 'No results found' : 'Enter a _search query to begin'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
