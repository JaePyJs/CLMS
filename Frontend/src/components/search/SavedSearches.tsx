import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Textarea,
} from '@/components/ui/textarea';
import {
  Switch,
} from '@/components/ui/switch';
import { Search, Star, Bookmark, Edit, Trash2, Eye, Users, BookOpen, Monitor, Plus, Copy, Share2, Bell, Clock, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description?: string;
  entityType: 'books' | 'students' | 'equipment' | 'global';
  searchParams: any;
  isPublic: boolean;
  enableNotifications: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  useCount: number;
}

interface SavedSearchFormData {
  name: string;
  description: string;
  entityType: 'books' | 'students' | 'equipment' | 'global';
  searchParams: any;
  isPublic: boolean;
  enableNotifications: boolean;
}

export default function SavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [popularSearches, setPopularSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [activeTab, setActiveTab] = useState('my-searches');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState<SavedSearchFormData>({
    name: '',
    description: '',
    entityType: 'books',
    searchParams: {},
    isPublic: false,
    enableNotifications: false,
  });

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches();
    loadPopularSearches();
  }, []);

  const loadSavedSearches = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/search/saved');
      if (response.success && response.data) {
        setSavedSearches(response.data.searches || []);
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
      toast.error('Failed to load saved searches');
    } finally {
      setLoading(false);
    }
  };

  const loadPopularSearches = async () => {
    try {
      const response = await apiClient.get('/api/search/saved/popular');
      if (response.success && response.data) {
        setPopularSearches(response.data);
      }
    } catch (error) {
      console.error('Failed to load popular searches:', error);
    }
  };

  const createSavedSearch = async () => {
    if (!formData.name.trim() || !formData.entityType) {
      toast.error('Name and entity type are required');
      return;
    }

    try {
      const response = await apiClient.post('/api/search/saved', formData);
      if (response.success) {
        toast.success('Saved search created successfully');
        setShowCreateDialog(false);
        resetForm();
        loadSavedSearches();
      }
    } catch (error) {
      console.error('Failed to create saved search:', error);
      toast.error('Failed to create saved search');
    }
  };

  const updateSavedSearch = async () => {
    if (!editingSearch || !formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const response = await apiClient.put(`/api/search/saved/${editingSearch.id}`, formData);
      if (response.success) {
        toast.success('Saved search updated successfully');
        setEditingSearch(null);
        resetForm();
        loadSavedSearches();
      }
    } catch (error) {
      console.error('Failed to update saved search:', error);
      toast.error('Failed to update saved search');
    }
  };

  const deleteSavedSearch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved search?')) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/search/saved/${id}`);
      if (response.success) {
        toast.success('Saved search deleted successfully');
        loadSavedSearches();
      }
    } catch (error) {
      console.error('Failed to delete saved search:', error);
      toast.error('Failed to delete saved search');
    }
  };

  const useSavedSearch = async (search: SavedSearch) => {
    try {
      // Record the usage
      await apiClient.get(`/api/search/saved/${search.id}`);

      // Navigate to appropriate search page with the saved parameters
      const baseUrl = '/search';
      const entityPath = search.entityType === 'global' ? '' : `/${search.entityType}`;
      const params = new URLSearchParams(search.searchParams);

      // This would typically trigger a navigation
      window.location.href = `${baseUrl}${entityPath}?${params.toString()}`;
    } catch (error) {
      console.error('Failed to use saved search:', error);
      toast.error('Failed to load saved search');
    }
  };

  const editSavedSearch = (search: SavedSearch) => {
    setEditingSearch(search);
    setFormData({
      name: search.name,
      description: search.description || '',
      entityType: search.entityType,
      searchParams: search.searchParams,
      isPublic: search.isPublic,
      enableNotifications: search.enableNotifications,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      entityType: 'books',
      searchParams: {},
      isPublic: false,
      enableNotifications: false,
    });
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'books':
        return <BookOpen className="w-4 h-4" />;
      case 'students':
        return <Users className="w-4 h-4" />;
      case 'equipment':
        return <Monitor className="w-4 h-4" />;
      case 'global':
        return <Search className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getEntityTypeLabel = (entityType: string) => {
    switch (entityType) {
      case 'books':
        return 'Books';
      case 'students':
        return 'Students';
      case 'equipment':
        return 'Equipment';
      case 'global':
        return 'Global';
      default:
        return entityType;
    }
  };

  const getSearchParamsSummary = (searchParams: any) => {
    const params = [];

    if (searchParams.query) params.push(`"${searchParams.query}"`);
    if (searchParams.category) params.push(`Category: ${searchParams.category}`);
    if (searchParams.gradeCategory) params.push(`Grade: ${searchParams.gradeCategory}`);
    if (searchParams.type) params.push(`Type: ${searchParams.type}`);
    if (searchParams.location) params.push(`Location: ${searchParams.location}`);
    if (searchParams.isAvailable) params.push('Available only');
    if (searchParams.hasFines) params.push('Has fines');

    return params.slice(0, 3).join(', ') + (params.length > 3 ? '...' : '');
  };

  const filteredSearches = savedSearches.filter(search => {
    const matchesQuery = search.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (search.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesEntityType = filterEntityType === 'all' || search.entityType === filterEntityType;
    return matchesQuery && matchesEntityType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="w-6 h-6" />
            Saved Searches
          </h1>
          <p className="text-muted-foreground">
            Manage your saved search queries and discover popular searches
          </p>
        </div>

        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Search
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search your saved searches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filterEntityType}
              onValueChange={setFilterEntityType}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="books">Books</SelectItem>
                <SelectItem value="students">Students</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-searches">
            <Star className="w-4 h-4 mr-2" />
            My Searches ({savedSearches.length})
          </TabsTrigger>
          <TabsTrigger value="popular">
            <TrendingUp className="w-4 h-4 mr-2" />
            Popular Searches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-searches" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading saved searches...</p>
            </div>
          ) : filteredSearches.length > 0 ? (
            <div className="grid gap-4">
              {filteredSearches.map((search) => (
                <Card key={search.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {getEntityTypeIcon(search.entityType)}
                            <h3 className="font-semibold text-lg">{search.name}</h3>
                          </div>

                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {getEntityTypeLabel(search.entityType)}
                            </Badge>

                            {search.isPublic && (
                              <Badge variant="secondary">
                                <Share2 className="w-3 h-3 mr-1" />
                                Public
                              </Badge>
                            )}

                            {search.enableNotifications && (
                              <Badge variant="outline">
                                <Bell className="w-3 h-3 mr-1" />
                                Notifications
                              </Badge>
                            )}
                          </div>
                        </div>

                        {search.description && (
                          <p className="text-muted-foreground mb-3">{search.description}</p>
                        )}

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            <strong>Parameters:</strong> {getSearchParamsSummary(search.searchParams)}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Used {search.useCount} times
                            </span>

                            {search.lastUsedAt && (
                              <span>
                                Last used {new Date(search.lastUsedAt).toLocaleDateString()}
                              </span>
                            )}

                            <span>
                              Created {new Date(search.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => useSavedSearch(search)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Use
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editSavedSearch(search)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSavedSearch(search.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-32">
                <Bookmark className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No saved searches found matching your criteria' : 'No saved searches yet'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Search
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          {popularSearches.length > 0 ? (
            <div className="grid gap-4">
              {popularSearches.map((search) => (
                <Card key={search.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {getEntityTypeIcon(search.entityType)}
                            <h3 className="font-semibold text-lg">{search.name}</h3>
                          </div>

                          <div className="flex gap-2">
                            <Badge variant="outline">
                              {getEntityTypeLabel(search.entityType)}
                            </Badge>

                            <Badge className="bg-green-500">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {search.useCount} uses
                            </Badge>
                          </div>
                        </div>

                        {search.description && (
                          <p className="text-muted-foreground mb-3">{search.description}</p>
                        )}

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            <strong>Parameters:</strong> {getSearchParamsSummary(search.searchParams)}
                          </div>

                          <div className="text-sm text-muted-foreground">
                            Created by {search.userId} • {new Date(search.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => useSavedSearch(search)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Use
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Copy search parameters to create new search
                            setFormData({
                              name: `Copy of ${search.name}`,
                              description: search.description || '',
                              entityType: search.entityType,
                              searchParams: search.searchParams,
                              isPublic: false,
                              enableNotifications: false,
                            });
                            setShowCreateDialog(true);
                          }}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-32">
                <TrendingUp className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No popular searches available yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingSearch} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingSearch(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSearch ? 'Edit Saved Search' : 'Create New Saved Search'}
            </DialogTitle>
            <DialogDescription>
              {editingSearch ? 'Update your saved search parameters' : 'Save your current search for future use'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="Enter search name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type *</label>
              <Select
                value={formData.entityType}
                onValueChange={(value: any) => setFormData({ ...formData, entityType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="books">Books</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Public Search</label>
                <p className="text-xs text-muted-foreground">
                  Allow other users to see and use this search
                </p>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Notifications</label>
                <p className="text-xs text-muted-foreground">
                  Get notified when new items match this search
                </p>
              </div>
              <Switch
                checked={formData.enableNotifications}
                onCheckedChange={(checked) => setFormData({ ...formData, enableNotifications: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingSearch(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingSearch ? updateSavedSearch : createSavedSearch}>
              {editingSearch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}