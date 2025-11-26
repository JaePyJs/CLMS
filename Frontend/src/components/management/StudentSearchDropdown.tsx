import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Clock, User, X, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface StudentSearchDropdownProps {
  onSelect: (student: { id: string; name: string; studentId: string }) => void;
  selectedStudentId?: string;
}

export function StudentSearchDropdown({
  onSelect,
  selectedStudentId,
}: StudentSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch recent scans on mount
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await apiClient.get<any[]>('/api/kiosk/recent-scans');
        if (res.success && res.data) {
          setRecentScans(res.data);
        }
      } catch (e) {
        console.error('Failed to fetch recent scans', e);
      }
    };
    fetchRecent();
  }, []);

  // Search students when query changes
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<any[]>(
          `/api/v1/students/search?q=${encodeURIComponent(query)}`
        );
        if (res.success && res.data) {
          setSearchResults(res.data);
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (student: any) => {
    const normalized = {
      id: student.id,
      studentId: student.student_id || student.studentId,
      name: student.name || `${student.first_name} ${student.last_name}`,
    };
    onSelect(normalized);
    setQuery(normalized.name); // Show name in input
    setIsOpen(false);
  };

  const clearSelection = () => {
    onSelect({ id: '', name: '', studentId: '' });
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search student or select recent..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8 pr-8"
        />
        {query && (
          <button
            onClick={clearSelection}
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-auto">
          {isLoading && (
            <div className="p-2 text-sm text-center text-muted-foreground">
              Searching...
            </div>
          )}

          {!query && recentScans.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recent Scans
              </div>
              {recentScans.map((student) => {
                const isPersonnel = student.studentId?.startsWith('PN');
                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors duration-200"
                    onClick={() => handleSelect(student)}
                  >
                    {isPersonnel ? (
                      <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{student.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {student.studentId}
                      </span>
                    </div>
                    {isPersonnel && (
                      <Badge
                        variant="outline"
                        className="ml-auto text-xs text-blue-600 dark:text-blue-400"
                      >
                        Personnel
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {query && searchResults.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Search Results
              </div>
              {searchResults.map((student) => {
                const isPersonnel =
                  student.student_id?.startsWith('PN') ||
                  student.type === 'PERSONNEL';
                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors duration-200"
                    onClick={() => handleSelect(student)}
                  >
                    {isPersonnel ? (
                      <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {student.student_id}
                      </span>
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {isPersonnel
                        ? 'Personnel'
                        : student.grade_level > 0
                          ? `Grade ${student.grade_level}`
                          : student.grade_category}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {query && !isLoading && searchResults.length === 0 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No students found.
            </div>
          )}

          {!query && recentScans.length === 0 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No recent scans.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
