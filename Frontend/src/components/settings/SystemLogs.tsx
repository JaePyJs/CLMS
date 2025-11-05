import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, RefreshCw, Trash2, Download, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  stack?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
}

export default function ErrorDashboard() {
  const { user } = useAuth();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'WARN'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Load errors on mount
  useEffect(() => {
    loadErrors();
    // Set up real-time error monitoring
    const interval = setInterval(loadErrors, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadErrors = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/logs/errors', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setErrors(data.errors || []);
      }
    } catch (error) {
      console.error('Failed to load errors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearErrors = async () => {
    try {
      const response = await fetch('/api/logs/errors/clear', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('clms_token') || sessionStorage.getItem('clms_token')}`,
        },
      });

      if (response.ok) {
        setErrors([]);
        toast.success('Error logs cleared');
      }
    } catch (error) {
      toast.error('Failed to clear error logs');
    }
  };

  const exportErrors = () => {
    const data = JSON.stringify(errors, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clms-errors-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Error logs exported');
  };

  const filteredErrors = errors.filter((error) => {
    const matchesFilter = filter === 'ALL' || error.level === filter;
    const matchesSearch =
      error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.endpoint?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Monitoring Dashboard
          </CardTitle>
          <CardDescription>
            Real-time error tracking and debugging for developers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={loadErrors}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button onClick={exportErrors} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={clearErrors} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Badge variant={errors.length > 0 ? 'destructive' : 'secondary'}>
              {errors.length} total errors
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant={filter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('ALL')}
              >
                All
              </Button>
              <Button
                variant={filter === 'ERROR' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setFilter('ERROR')}
              >
                Errors
              </Button>
              <Button
                variant={filter === 'WARN' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setFilter('WARN')}
              >
                Warnings
              </Button>
            </div>

            <div className="flex-1">
              <input
                type="text"
                placeholder="Search errors..."
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Error List */}
          <ScrollArea className="h-[600px] w-full rounded-md border">
            <div className="p-4 space-y-3">
              {filteredErrors.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No errors found
                </div>
              ) : (
                filteredErrors.map((error) => (
                  <div
                    key={error.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={getLevelColor(error.level)}>
                          {error.level}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="font-semibold">{error.message}</div>

                    {error.endpoint && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Endpoint:</span>{' '}
                        <code className="bg-muted px-2 py-1 rounded">
                          {error.method} {error.endpoint}
                        </code>
                      </div>
                    )}

                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                          View Stack Trace
                        </summary>
                        <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-blue-700 dark:text-blue-300">
            How to Use Error Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
          <p>
            <strong>Real-time Monitoring:</strong> Errors appear automatically
            every 5 seconds
          </p>
          <p>
            <strong>Filter by Level:</strong> Show all errors, only errors, or
            only warnings
          </p>
          <p>
            <strong>Search:</strong> Find specific error messages or endpoints
          </p>
          <p>
            <strong>Export:</strong> Download error logs as JSON for analysis
          </p>
          <p>
            <strong>Debug:</strong> View full stack traces to identify the issue
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
