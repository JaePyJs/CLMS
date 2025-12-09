/**
 * Quick Service Panel Component
 * For handling "print and go" students and forgot barcode scenarios
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Printer,
  Copy,
  FileText,
  HelpCircle,
  AlertTriangle,
  User,
  UserCheck,
  Zap,
  Clock,
  X,
  Loader2,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

type QuickServiceType =
  | 'PRINTING'
  | 'PHOTOCOPY'
  | 'LAMINATION'
  | 'INQUIRY'
  | 'OTHER';

interface Student {
  id: string;
  studentId: string;
  name: string;
  gradeLevel: string;
  section: string;
  photoUrl?: string;
}

interface QuickServicePanelProps {
  onServiceComplete?: () => void;
}

export default function QuickServicePanel({
  onServiceComplete,
}: QuickServicePanelProps) {
  // Quick Service state
  const [quickServiceType, setQuickServiceType] =
    useState<QuickServiceType>('PRINTING');
  const [quickServiceInput, setQuickServiceInput] = useState('');
  const [quickServiceNotes, setQuickServiceNotes] = useState('');
  const [isProcessingQuickService, setIsProcessingQuickService] =
    useState(false);

  // Live search state for quick service
  const [quickSearchResults, setQuickSearchResults] = useState<Student[]>([]);
  const [isQuickSearching, setIsQuickSearching] = useState(false);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [selectedQuickStudent, setSelectedQuickStudent] =
    useState<Student | null>(null);
  const quickDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuickSearch = useDebounce(quickServiceInput, 150);

  // Manual Lookup state
  const [showManualLookup, setShowManualLookup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [manualCheckInReason, setManualCheckInReason] =
    useState('Forgot barcode');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Live search effect for quick service input - Google style instant search
  useEffect(() => {
    const searchStudents = async () => {
      // Only search if input is 1+ characters and not a pure barcode/ID
      if (debouncedQuickSearch.length < 1) {
        setQuickSearchResults([]);
        setShowQuickDropdown(false);
        return;
      }

      // If it looks like a barcode (all numbers), don't show dropdown
      if (/^\d+$/.test(debouncedQuickSearch)) {
        setQuickSearchResults([]);
        setShowQuickDropdown(false);
        return;
      }

      setIsQuickSearching(true);
      try {
        const response = await apiClient.get(
          `/api/manual-lookup/search?q=${encodeURIComponent(debouncedQuickSearch)}`
        );

        if (response.success && response.data) {
          setQuickSearchResults(response.data as Student[]);
          setShowQuickDropdown((response.data as Student[]).length > 0);
        }
      } catch {
        // Silently fail - don't interrupt user
      } finally {
        setIsQuickSearching(false);
      }
    };

    searchStudents();
  }, [debouncedQuickSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickDropdownRef.current &&
        !quickDropdownRef.current.contains(event.target as Node)
      ) {
        setShowQuickDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global key listener for barcode scanner
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input or textarea, don't interfere
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // If it's a number, it might be a barcode scan starting
      if (/^\d$/.test(e.key)) {
        // Focus the quick service input
        const input = document.getElementById('quick-service-input');
        if (input) {
          input.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Handle selecting a student from dropdown
  const handleSelectQuickStudent = (student: Student) => {
    setSelectedQuickStudent(student);
    setQuickServiceInput(student.name);
    setShowQuickDropdown(false);
  };

  // Clear selected student
  const handleClearQuickStudent = () => {
    setSelectedQuickStudent(null);
    setQuickServiceInput('');
    setQuickSearchResults([]);
  };

  // Quick Service handler
  const handleQuickService = async () => {
    // Use selected student ID or the raw input (for barcode scans)
    const studentIdToUse =
      selectedQuickStudent?.studentId || quickServiceInput.trim();

    if (!studentIdToUse) {
      toast.warning('Please enter a student ID, barcode, or search by name');
      return;
    }

    setIsProcessingQuickService(true);
    try {
      const response = await apiClient.post<{ message?: string }>(
        '/api/quick-service',
        {
          studentId: studentIdToUse,
          serviceType: quickServiceType,
          notes: quickServiceNotes || undefined,
          usedManualLookup: !!selectedQuickStudent,
        }
      );

      if (response.success) {
        toast.success(
          (response.data as { message?: string })?.message ||
            'Quick service logged'
        );
        setQuickServiceInput('');
        setQuickServiceNotes('');
        setSelectedQuickStudent(null);
        setQuickSearchResults([]);
        onServiceComplete?.();
      } else {
        toast.error(response.error || 'Failed to log quick service');
      }
    } catch {
      toast.error('Failed to process quick service');
    } finally {
      setIsProcessingQuickService(false);
    }
  };

  // Search for students by name
  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) {
      toast.warning('Please enter at least 2 characters to search');
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.get(
        `/api/manual-lookup/search?q=${encodeURIComponent(searchQuery.trim())}`
      );

      if (response.success && response.data) {
        setSearchResults(response.data as Student[]);
        if ((response.data as Student[]).length === 0) {
          toast.info('No students found matching your search');
        }
      } else {
        toast.error(response.error || 'Search failed');
        setSearchResults([]);
      }
    } catch {
      toast.error('Failed to search students');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle manual check-in (forgot barcode)
  const handleManualCheckIn = async () => {
    if (!selectedStudent) {
      toast.warning('Please select a student first');
      return;
    }

    setIsCheckingIn(true);
    setWarningMessage(null);
    try {
      const response = await apiClient.post<{
        message?: string;
        warning?: string;
      }>('/api/manual-lookup/check-in', {
        studentId: selectedStudent.id,
        reason: manualCheckInReason,
      });

      if (response.success) {
        toast.success(
          (response.data as { message?: string })?.message ||
            `${selectedStudent.name} checked in manually`
        );

        // Show warning if student frequently forgets barcode
        if ((response as { warning?: string }).warning) {
          setWarningMessage((response as { warning?: string }).warning || null);
        } else {
          setShowManualLookup(false);
          setSelectedStudent(null);
          setSearchQuery('');
          setSearchResults([]);
          onServiceComplete?.();
        }
      } else {
        toast.error(response.error || 'Failed to check in student');
      }
    } catch {
      toast.error('Failed to check in student manually');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const getServiceIcon = (type: QuickServiceType) => {
    switch (type) {
      case 'PRINTING':
        return <Printer className="h-4 w-4" />;
      case 'PHOTOCOPY':
        return <Copy className="h-4 w-4" />;
      case 'LAMINATION':
        return <FileText className="h-4 w-4" />;
      case 'INQUIRY':
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Service Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Service Mode
          </CardTitle>
          <CardDescription>
            For students who just need to print/photocopy and leave immediately.
            These visits don't count towards leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single column layout - cleaner */}
          <div className="space-y-4">
            <div className="space-y-2" ref={quickDropdownRef}>
              <label className="text-sm font-medium">
                Student (Search by name or scan barcode)
              </label>
              {selectedQuickStudent ? (
                // Show selected student
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <User className="h-4 w-4 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedQuickStudent.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedQuickStudent.studentId} •{' '}
                      {selectedQuickStudent.gradeLevel}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleClearQuickStudent}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Show search input with Google-style instant search
                <div className="relative" ref={quickDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Scan barcode or type name..."
                      value={quickServiceInput}
                      onChange={(e) => {
                        setQuickServiceInput(e.target.value);
                        // Only show dropdown for non-numeric input (names)
                        if (!/^\d+$/.test(e.target.value)) {
                          setShowQuickDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        if (
                          quickServiceInput &&
                          !/^\d+$/.test(quickServiceInput)
                        ) {
                          setShowQuickDropdown(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickService();
                        }
                      }}
                      className="pl-9 pr-8"
                      id="quick-service-input"
                      autoFocus
                    />
                    {isQuickSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Dropdown results - Google style instant */}
                  {showQuickDropdown &&
                    quickServiceInput.length >= 1 &&
                    !/^\d+$/.test(quickServiceInput) && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {isQuickSearching ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Searching...
                          </div>
                        ) : quickSearchResults.length > 0 ? (
                          quickSearchResults.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 border-b last:border-b-0"
                              onClick={() => handleSelectQuickStudent(student)}
                            >
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {student.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {student.studentId} • {student.gradeLevel}
                                </p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            No students found
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Service Type - horizontal buttons for quick selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Type</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'PRINTING', label: 'Printing', icon: Printer },
                  { value: 'PHOTOCOPY', label: 'Photocopy', icon: Copy },
                  { value: 'LAMINATION', label: 'Lamination', icon: FileText },
                  { value: 'INQUIRY', label: 'Inquiry', icon: HelpCircle },
                  { value: 'OTHER', label: 'Other', icon: Zap },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={quickServiceType === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setQuickServiceType(value as QuickServiceType)
                    }
                    className="flex items-center gap-1"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <Input
              placeholder="e.g., 5 pages colored"
              value={quickServiceNotes}
              onChange={(e) => setQuickServiceNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleQuickService}
              disabled={isProcessingQuickService}
              className="flex-1"
            >
              {getServiceIcon(quickServiceType)}
              <span className="ml-2">
                {isProcessingQuickService
                  ? 'Processing...'
                  : 'Log Quick Service'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Forgot Barcode Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-orange-500" />
            Student Forgot Barcode?
          </CardTitle>
          <CardDescription>
            Manually look up and check in students who forgot their barcode.
            These visits won't count towards leaderboard rankings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setShowManualLookup(true)}
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            Search Student by Name
          </Button>
        </CardContent>
      </Card>

      {/* Manual Lookup Dialog */}
      <Dialog open={showManualLookup} onOpenChange={setShowManualLookup}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Manual Student Lookup
            </DialogTitle>
            <DialogDescription>
              Search for a student by name. Manual check-ins don't count towards
              leaderboard rankings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter student name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStudent?.id === student.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {student.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{student.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {student.studentId} • {student.gradeLevel}{' '}
                        {student.section}
                      </div>
                    </div>
                    {selectedStudent?.id === student.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Selected Student Actions */}
            {selectedStudent && (
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{selectedStudent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Ready to check in manually
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason</label>
                  <Select
                    value={manualCheckInReason}
                    onValueChange={setManualCheckInReason}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Forgot barcode">
                        Forgot barcode
                      </SelectItem>
                      <SelectItem value="Lost barcode">Lost barcode</SelectItem>
                      <SelectItem value="Barcode damaged">
                        Barcode damaged
                      </SelectItem>
                      <SelectItem value="New student">
                        New student (no barcode yet)
                      </SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Warning message for frequent offenders */}
                {warningMessage && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>{warningMessage}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowManualLookup(false);
                setSelectedStudent(null);
                setSearchQuery('');
                setSearchResults([]);
                setWarningMessage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualCheckIn}
              disabled={!selectedStudent || isCheckingIn}
            >
              {isCheckingIn ? 'Checking In...' : 'Check In Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
