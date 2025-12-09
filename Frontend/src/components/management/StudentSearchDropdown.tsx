import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Clock, User, X, Briefcase, CheckCircle } from 'lucide-react';
import { apiClient, enhancedLibraryApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface StudentRecord {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  student_id?: string;
  studentId?: string;
  studentName?: string;
  gradeLevel?: string;
  grade_level?: number;
  grade_category?: string;
  purpose?: string;
  type?: string;
}

interface StudentSearchDropdownProps {
  onSelect: (_student: { id: string; name: string; studentId: string }) => void;
  selectedStudentId?: string;
  /** If true, only shows currently checked-in (active) students */
  activeOnly?: boolean;
}

export function StudentSearchDropdown({
  onSelect,
  selectedStudentId: _selectedStudentId,
  activeOnly = false,
}: StudentSearchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentScans, setRecentScans] = useState<StudentRecord[]>([]);
  const [activeStudents, setActiveStudents] = useState<StudentRecord[]>([]);
  const [searchResults, setSearchResults] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fetch recent scans or active students on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (activeOnly) {
          // Fetch currently checked-in students
          const res = await enhancedLibraryApi.getCurrentPatrons();
          if (res.success && res.data) {
            const patrons =
              (res.data as { patrons?: StudentRecord[] }).patrons || [];
            setActiveStudents(patrons);
          }
        } else {
          // Fetch recent scans
          const res = await apiClient.get<StudentRecord[]>(
            '/api/kiosk/recent-scans'
          );
          if (res.success && res.data) {
            setRecentScans(res.data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch data', e);
      }
    };
    fetchData();

    // Refresh active students periodically if activeOnly
    if (activeOnly) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [activeOnly]);

  // Search students when query changes - Google style (start from 1 char)
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Start searching immediately from 1 character
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        if (activeOnly) {
          // Filter active students locally
          const filtered = activeStudents.filter((s) => {
            const name =
              s.studentName?.toLowerCase() || s.name?.toLowerCase() || '';
            const studentId = s.studentId?.toLowerCase() || '';
            const q = query.toLowerCase();
            return name.includes(q) || studentId.includes(q);
          });
          setSearchResults(filtered);
        } else {
          // Search all students via API (min 1 char for Google-style)
          if (query.length >= 1) {
            const res = await apiClient.get<{
              success: boolean;
              data: StudentRecord[];
              count: number;
            }>(`/api/students/search?q=${encodeURIComponent(query)}`);
            if (res.success && res.data) {
              // Check if data is nested (server response wrapped by apiClient)
              const students = Array.isArray(res.data)
                ? res.data
                : res.data.data || [];
              setSearchResults(students);
            }
          }
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsLoading(false);
      }
    }, 150); // Faster debounce for Google-style feel

    return () => clearTimeout(timer);
  }, [query, activeOnly, activeStudents]);

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

  const handleSelect = (student: StudentRecord) => {
    const normalized = {
      id: student.id,
      studentId: student.student_id || student.studentId || '',
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

          {/* Show active students when activeOnly and no query */}
          {!query && activeOnly && activeStudents.length > 0 && (
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Active
                Students ({activeStudents.length})
              </div>
              {activeStudents.map((student) => {
                const isPersonnel = student.studentId?.startsWith('PN');
                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors duration-200"
                    onClick={() =>
                      handleSelect({
                        id: student.id,
                        studentId: student.studentId,
                        name: student.studentName || student.name,
                      })
                    }
                  >
                    {isPersonnel ? (
                      <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User className="h-4 w-4 text-green-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {student.studentName || student.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {student.studentId}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-auto text-xs text-green-600 dark:text-green-400"
                    >
                      {student.purpose || 'Checked In'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show recent scans when NOT activeOnly and no query */}
          {!query && !activeOnly && recentScans.length > 0 && (
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
                {activeOnly ? 'Matching Active Students' : 'Search Results'}
              </div>
              {searchResults.map((student) => {
                const studentId = student.student_id || student.studentId;
                const isPersonnel =
                  studentId?.startsWith('PN') || student.type === 'PERSONNEL';
                const displayName =
                  student.studentName ||
                  student.name ||
                  (student.first_name
                    ? `${student.first_name} ${student.last_name}`
                    : 'Unknown');
                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors duration-200"
                    onClick={() =>
                      handleSelect({
                        ...student,
                        studentId: studentId,
                        name: displayName,
                      })
                    }
                  >
                    {isPersonnel ? (
                      <Briefcase className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <User
                        className={`h-4 w-4 ${activeOnly ? 'text-green-500' : 'text-muted-foreground'}`}
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {studentId}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-xs ${activeOnly ? 'text-green-600 dark:text-green-400' : ''}`}
                    >
                      {activeOnly && student.purpose
                        ? student.purpose
                        : isPersonnel
                          ? 'Personnel'
                          : (student.grade_level ?? 0) > 0
                            ? `Grade ${student.grade_level}`
                            : student.gradeLevel || student.grade_category}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}

          {query && !isLoading && searchResults.length === 0 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              {activeOnly
                ? 'No active students match your search.'
                : 'No students found.'}
            </div>
          )}

          {!query && !activeOnly && recentScans.length === 0 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No recent scans.
            </div>
          )}

          {!query && activeOnly && activeStudents.length === 0 && (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No students currently checked in.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
