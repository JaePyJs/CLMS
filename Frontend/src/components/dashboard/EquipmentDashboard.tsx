import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useMobileOptimization,
  useTouchOptimization,
  getResponsiveClasses,
} from '@/hooks/useMobileOptimization';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useEndSession,
  useStartSession,
  useExtendSession,
  useEquipment,
} from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { offlineActions } from '@/lib/offline-queue';
import { enhancedLibraryApi } from '@/lib/api';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

import {
  Monitor,
  Gamepad2,
  Cpu,
  Play,
  Square,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Settings,
  WifiOff,
  History,
  Users,
  GripVertical,
  Plus,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { DraggableStudent } from './equipment/DraggableStudent';
import { DroppableEquipment } from './equipment/DroppableEquipment';
import { toast } from 'sonner';
import { equipmentApi, settingsApi } from '@/lib/api';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActivePatron {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string | number;
  purpose: string;
}

interface AssignedStudent extends ActivePatron {
  equipmentId: string;
  equipmentName: string;
  sessionId: string;
  remainingMinutes: number;
}

interface SessionHistoryItem {
  id: string;
  studentName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

export function EquipmentDashboard() {
  // Mobile optimization
  const mobileState = useMobileOptimization();
  const { isMobile } = mobileState;
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [gradeLevel, setGradeLevel] = useState<string>('');

  // Session History State
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(
    []
  );
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Add Equipment Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    category: 'computer',
    serial_number: '',
    notes: '',
  });

  // Delete Equipment State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings Dialog State
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [sessionLimits, setSessionLimits] = useState({
    PRIMARY: 15,
    GRADE_SCHOOL: 30,
    JUNIOR_HIGH: 45,
    SENIOR_HIGH: 60,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Drag and Drop State
  const [activePatrons, setActivePatrons] = useState<ActivePatron[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<
    ActivePatron | AssignedStudent | null
  >(null);

  const { equipment: equipmentData, isOnline } = useAppStore();
  const setEquipment = useAppStore((state) => state.setEquipment);

  // Compute students currently assigned to rooms from equipment data
  const assignedStudents: AssignedStudent[] = (
    Array.isArray(equipmentData) ? equipmentData : []
  )
    .filter((e) => e.currentSession)
    .map((e) => ({
      id: `assigned-${e.currentSession!.studentId}`,
      studentId: e.currentSession!.studentId,
      studentName: e.currentSession!.studentName || 'Unknown',
      gradeLevel: e.currentSession!.gradeLevel || '',
      purpose: 'equipment',
      equipmentId: e.id,
      equipmentName: e.name,
      sessionId: e.currentSession!.id,
      remainingMinutes: e.currentSession!.remainingMinutes || 0,
    }));

  // Fetch session history for a room
  const fetchSessionHistory = async (equipmentId: string) => {
    setLoadingHistory(equipmentId);
    try {
      const response = await equipmentApi.getSessionHistory(equipmentId);
      if (response.success && response.data) {
        const sessions = (response.data as any[]).map((s: any) => ({
          id: s.id,
          studentName: s.student
            ? `${s.student.first_name} ${s.student.last_name}`
            : 'Unknown',
          startTime: s.start_time,
          endTime: s.end_time,
          duration: s.end_time
            ? Math.round(
                (new Date(s.end_time).getTime() -
                  new Date(s.start_time).getTime()) /
                  60000
              )
            : undefined,
        }));
        setSessionHistory(sessions);
      }
    } catch (error) {
      console.error('Failed to fetch session history', error);
      setSessionHistory([]);
    } finally {
      setLoadingHistory(null);
    }
  };

  // Fetch equipment data
  useEquipment();

  const { mutate: endSession } = useEndSession();
  const { mutate: startSession } = useStartSession();
  const { mutate: extendSession } = useExtendSession();

  // Dnd Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Get WebSocket context for real-time updates
  const { recentActivities } = useWebSocketContext();

  const fetchActivePatrons = useCallback(async () => {
    try {
      const response = await enhancedLibraryApi.getCurrentPatrons();
      if (response.success && response.data) {
        const patrons = (response.data as any).patrons || [];
        // Filter out patrons who already have an active equipment session
        // This requires checking against the equipment list
        const activeEquipmentStudentIds = equipmentData
          .filter((e) => e.currentSession)
          .map((e) => e.currentSession?.studentId);

        const availablePatrons = patrons.filter(
          (p: ActivePatron) => !activeEquipmentStudentIds.includes(p.studentId)
        );

        setActivePatrons(availablePatrons);
      }
    } catch (error) {
      console.error('Failed to fetch active patrons', error);
    }
  }, [equipmentData]);

  // Add new equipment/room
  const handleAddEquipment = async () => {
    if (!newEquipment.name.trim()) {
      toast.error('Please enter a name for the room/equipment');
      return;
    }

    setIsAddingEquipment(true);
    try {
      const response = await equipmentApi.create({
        name: newEquipment.name,
        category: newEquipment.category,
        serial_number: newEquipment.serial_number || undefined,
        notes: newEquipment.notes || undefined,
        status: 'AVAILABLE',
      });

      if (response.success) {
        toast.success(`${newEquipment.name} added successfully!`);
        setShowAddDialog(false);
        setNewEquipment({
          name: '',
          category: 'computer',
          serial_number: '',
          notes: '',
        });
        // Trigger refresh
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
      } else {
        toast.error('Failed to add equipment');
      }
    } catch (error) {
      console.error('Error adding equipment:', error);
      toast.error('Failed to add equipment');
    } finally {
      setIsAddingEquipment(false);
    }
  };

  // Delete equipment/room
  const handleDeleteEquipment = async () => {
    if (!equipmentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await equipmentApi.delete(equipmentToDelete.id);
      if (response.success) {
        toast.success(`${equipmentToDelete.name} deleted successfully!`);
        setShowDeleteDialog(false);
        setEquipmentToDelete(null);
        // Trigger refresh
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
      } else {
        toast.error('Failed to delete equipment');
      }
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error(
        'Failed to delete equipment. Make sure no active sessions are running.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Load session limits settings
  const loadSessionLimits = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await settingsApi.getSystemSettings();
      if (response.success && response.data) {
        const data = response.data as any;
        if (data.sessionLimits) {
          setSessionLimits({
            PRIMARY: data.sessionLimits.PRIMARY || 15,
            GRADE_SCHOOL: data.sessionLimits.GRADE_SCHOOL || 30,
            JUNIOR_HIGH: data.sessionLimits.JUNIOR_HIGH || 45,
            SENIOR_HIGH: data.sessionLimits.SENIOR_HIGH || 60,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session limits:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Save session limits settings
  const saveSessionLimits = async () => {
    setIsSavingSettings(true);
    try {
      const response = await settingsApi.updateSystemSettings({
        sessionLimits: sessionLimits,
      });
      if (response.success) {
        toast.success('Session limits saved successfully!');
        setShowSettingsDialog(false);
      } else {
        toast.error('Failed to save session limits');
      }
    } catch (error) {
      console.error('Failed to save session limits:', error);
      toast.error('Failed to save session limits');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Load settings when dialog opens
  useEffect(() => {
    if (showSettingsDialog) {
      loadSessionLimits();
    }
  }, [showSettingsDialog]);

  useEffect(() => {
    fetchActivePatrons();
    const interval = setInterval(fetchActivePatrons, 30000);
    return () => clearInterval(interval);
  }, [equipmentData, fetchActivePatrons]); // Re-fetch when equipment data changes (e.g. session starts)

  // Refresh active patrons immediately when a check-in/check-out happens via WebSocket
  useEffect(() => {
    if (recentActivities.length > 0) {
      const latestActivity = recentActivities[0];
      // If there's a new check-in or check-out, refresh the patrons list
      if (
        latestActivity.type === 'CHECK_IN' ||
        latestActivity.type === 'CHECK_OUT'
      ) {
        fetchActivePatrons();
      }
    }
  }, [recentActivities, fetchActivePatrons]);

  useEffect(() => {
    // Real-time updates are handled by WebSocketContext and useAppStore
  }, [setEquipment]);

  const equipment = Array.isArray(equipmentData) ? equipmentData : [];

  // Filter equipment based on selected filter
  const filteredEquipment = (Array.isArray(equipment) ? equipment : []).filter(
    (item) => {
      if (selectedFilter === 'all') {
        return true;
      }
      if (selectedFilter === 'available') {
        return item.status === 'available';
      }
      if (selectedFilter === 'in-use') {
        return item.status === 'in-use';
      }
      if (selectedFilter === 'computers') {
        return item.type === 'computer';
      }
      if (selectedFilter === 'gaming') {
        return item.type === 'gaming';
      }
      if (selectedFilter === 'avr') {
        return item.type === 'avr';
      }
      return true;
    }
  );

  const handleEndSession = async (sessionId: string) => {
    if (isOnline) {
      endSession(sessionId);
    } else {
      await offlineActions.endSession(sessionId);
    }
  };

  const getTimeLimitByGrade = (grade: string | number): number => {
    const g = String(grade || '').toLowerCase();
    if (g.includes('grade 1') || g.includes('grade 2') || g.includes('grade 3'))
      return 15;
    if (g.includes('grade 4') || g.includes('grade 5') || g.includes('grade 6'))
      return 30;
    if (g.includes('grade 7') || g.includes('grade 8') || g.includes('grade 9'))
      return 45;
    if (
      g.includes('grade 10') ||
      g.includes('grade 11') ||
      g.includes('grade 12')
    )
      return 60;

    // Handle numeric grades directly if they come as numbers (e.g. 12)
    const gradeNum = parseInt(g.replace(/\D/g, ''), 10);
    if (!isNaN(gradeNum)) {
      if (gradeNum >= 1 && gradeNum <= 3) return 15;
      if (gradeNum >= 4 && gradeNum <= 6) return 30;
      if (gradeNum >= 7 && gradeNum <= 10) return 45;
      if (gradeNum >= 11 && gradeNum <= 12) return 60;
    }

    return 30;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    // Check both available patrons and assigned students
    const student =
      activePatrons.find((p) => p.id === active.id) ||
      assignedStudents.find((s) => s.id === active.id);
    if (student) setDraggedStudent(student);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setDraggedStudent(null);

    if (over && active) {
      const equipmentId = over.id as string;
      const patronId = active.id as string;

      // Check if it's an assigned student being moved
      const assignedStudent = assignedStudents.find((s) => s.id === patronId);
      const patron =
        activePatrons.find((p) => p.id === patronId) || assignedStudent;
      const targetEquipment = equipment.find((e) => e.id === equipmentId);

      if (!patron) {
        toast.error('Student not found');
        return;
      }

      if (!targetEquipment) {
        toast.error('Equipment not found');
        return;
      }

      // If moving an assigned student to a different room
      if (assignedStudent) {
        // Don't allow dropping on the same room
        if (assignedStudent.equipmentId === equipmentId) {
          toast.info('Student is already in this room');
          return;
        }

        // Check if target is available
        if (targetEquipment.status !== 'available') {
          toast.error(
            `Cannot move to ${targetEquipment.name} - room is ${targetEquipment.status}`
          );
          return;
        }

        // End current session and start new one
        toast.info(
          `Moving ${patron.studentName} to ${targetEquipment.name}...`
        );
        endSession(assignedStudent.sessionId);

        // Small delay before starting new session
        setTimeout(() => {
          const sessionData = {
            equipmentId: equipmentId,
            studentId: patron.studentId,
            timeLimitMinutes: getTimeLimitByGrade(patron.gradeLevel),
          };
          startSession(sessionData);
        }, 500);
        return;
      }

      // Normal case: assigning available patron to room
      if (targetEquipment.status !== 'available') {
        toast.error(`Equipment is ${targetEquipment.status}, not available`);
        return;
      }

      const sessionData = {
        equipmentId: equipmentId,
        studentId: patron.studentId,
        timeLimitMinutes: getTimeLimitByGrade(patron.gradeLevel),
      };

      // Start session
      startSession(sessionData);
      toast.success(
        `Assigning ${patron.studentName} to ${targetEquipment.name}`
      );

      // Optimistically remove from list
      setActivePatrons((prev) => prev.filter((p) => p.id !== patronId));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500 dark:bg-green-400';
      case 'in-use':
        return 'bg-blue-500 dark:bg-blue-400';
      case 'maintenance':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Available
          </Badge>
        );
      case 'in-use':
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            In Use
          </Badge>
        );
      case 'maintenance':
        return <Badge variant="secondary">Maintenance</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'computer':
        return <Monitor className="h-5 w-5" />;
      case 'gaming':
        return <Gamepad2 className="h-5 w-5" />;
      case 'avr':
        return <Cpu className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes <= 0) {
      return 'Expired';
    }
    return `${minutes}m remaining`;
  };

  const getSessionProgress = (session: Record<string, unknown> | null) => {
    if (!session) {
      return 0;
    }
    const timeLimitMinutes = Number(session.timeLimitMinutes);
    const remainingMinutes = Number(session.remainingMinutes);
    const elapsed = timeLimitMinutes - remainingMinutes;
    return (elapsed / timeLimitMinutes) * 100;
  };

  // Handle double-tap to refresh on mobile - removed gesture functionality

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={getResponsiveClasses('space-y-6', mobileState)}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-900/30 dark:to-purple-900/30 p-6 rounded-xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
                <Monitor className="h-6 w-6 text-white" />
              </div>
              Room Management
            </h2>
            <p className="text-muted-foreground mt-1">
              Monitor and manage library rooms and discussion areas.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md"
              size="sm"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRefreshing(true);
                fetchActivePatrons();
                setTimeout(() => setIsRefreshing(false), 1000);
              }}
              disabled={isRefreshing}
            >
              <Clock
                className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={() => setShowSettingsDialog(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Equipment Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Status Overview */}
            <div
              className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}
            >
              <Card className="border-0 shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Rooms
                  </CardTitle>
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <Monitor className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{equipment.length}</div>
                  <p className="text-xs text-muted-foreground">All rooms</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                    Available
                  </CardTitle>
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {equipment.filter((e) => e.status === 'available').length}
                  </div>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70">
                    Ready for use
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    In Use
                  </CardTitle>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {equipment.filter((e) => e.status === 'in-use').length}
                  </div>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                    Active sessions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                    Issues
                  </CardTitle>
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {
                      equipment.filter((e) =>
                        ['maintenance', 'offline'].includes(e.status)
                      ).length
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need attention
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Connection Status */}
            {!isOnline && (
              <Alert>
                <WifiOff className="h-4 w-4" />
                <AlertDescription>
                  You are currently offline. Session changes will be queued and
                  synced when connection is restored.
                </AlertDescription>
              </Alert>
            )}

            {/* Equipment List */}
            <Tabs
              defaultValue="all"
              className={`space-y-${isMobile ? '3' : '4'}`}
            >
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger
                    value="all"
                    onClick={() => setSelectedFilter('all')}
                    disabled={isRefreshing}
                  >
                    All Rooms
                  </TabsTrigger>
                  <TabsTrigger
                    value="available"
                    onClick={() => setSelectedFilter('available')}
                    disabled={isRefreshing}
                  >
                    Available
                  </TabsTrigger>
                  <TabsTrigger
                    value="in-use"
                    onClick={() => setSelectedFilter('in-use')}
                    disabled={isRefreshing}
                  >
                    In Use
                  </TabsTrigger>
                  <TabsTrigger
                    value="computers"
                    onClick={() => setSelectedFilter('computers')}
                    disabled={isRefreshing}
                  >
                    Computers
                  </TabsTrigger>
                  <TabsTrigger
                    value="gaming"
                    onClick={() => setSelectedFilter('gaming')}
                    disabled={isRefreshing}
                  >
                    Gaming
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {filteredEquipment.length} items
                  </Badge>
                </div>
              </div>

              <TabsContent
                value="all"
                className={`space-y-${isMobile ? '3' : '4'}`}
              >
                <div
                  className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`}
                >
                  {filteredEquipment.map((item: any) => (
                    <DroppableEquipment
                      key={item.id}
                      id={item.id}
                      disabled={item.status !== 'available'}
                    >
                      <Card className="relative h-full overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0 flex-shrink">
                              {getEquipmentIcon(item.type)}
                              <CardTitle className="text-sm truncate">
                                {item.name}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <div
                                className={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusColor(item.status)}`}
                              ></div>
                              {getStatusBadge(item.status)}
                            </div>
                          </div>
                          {/* Actions Row - moved to separate row to prevent overflow */}
                          <div className="flex items-center gap-1 mt-2">
                            <Dialog
                              onOpenChange={(open) => {
                                if (open) fetchSessionHistory(item.id);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={isRefreshing}
                                >
                                  <History className="h-3 w-3 mr-1" />
                                  History
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>
                                    Session History – {item.name}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="max-h-80 overflow-y-auto">
                                  {loadingHistory === item.id ? (
                                    <div className="flex items-center justify-center py-8">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    </div>
                                  ) : sessionHistory.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                      No session history found for this room.
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {sessionHistory.map((session) => (
                                        <div
                                          key={session.id}
                                          className="p-3 border rounded-lg bg-muted/30"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">
                                              {session.studentName}
                                            </span>
                                            {session.duration !== undefined && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {session.duration} min
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {new Date(
                                              session.startTime
                                            ).toLocaleString()}
                                            {session.endTime && (
                                              <span>
                                                {' '}
                                                –{' '}
                                                {new Date(
                                                  session.endTime
                                                ).toLocaleTimeString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Room Actions Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={isRefreshing}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast.info(`Editing ${item.name}...`);
                                  }}
                                >
                                  <Settings className="h-4 w-4 mr-2" />
                                  Edit Room
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setEquipmentToDelete({
                                      id: item.id,
                                      name: item.name,
                                    });
                                    setShowDeleteDialog(true);
                                  }}
                                  disabled={item.status === 'in-use'}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Room
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardDescription>{item.type}</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          {/* Current Session Info */}
                          {item.currentSession ? (
                            <div className="space-y-3">
                              <div className="p-3 bg-primary/10 dark:bg-primary/5 rounded-lg border border-primary/20 dark:border-primary/10">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">
                                    Active Session
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatTimeRemaining(
                                      item.currentSession.remainingMinutes
                                    )}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <User className="h-3 w-3" />
                                    <span>
                                      {item.currentSession.studentName}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      Started:{' '}
                                      {new Date(
                                        item.currentSession.startTime
                                      ).toLocaleTimeString()}
                                    </span>
                                  </div>
                                </div>
                                <Progress
                                  value={getSessionProgress(
                                    item.currentSession
                                  )}
                                  className="mt-2 h-2"
                                />
                              </div>

                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleEndSession(item.currentSession.id)
                                  }
                                  className="flex-1"
                                  disabled={isRefreshing}
                                >
                                  <Square className="h-3 w-3 mr-1" />
                                  End Session
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (item.currentSession) {
                                      extendSession({
                                        sessionId: item.currentSession.id,
                                        additionalMinutes: 10,
                                      });
                                    }
                                  }}
                                  disabled={isRefreshing}
                                  title="Extend by 10 minutes"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              </div>
                              {/* Extend time buttons - now in a separate row */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-muted-foreground mr-1">
                                  Extend:
                                </span>
                                {[15, 30].map((m) => (
                                  <Button
                                    key={`ext-${item.id}-${m}`}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      if (item.currentSession) {
                                        extendSession({
                                          sessionId: item.currentSession.id,
                                          additionalMinutes: m,
                                        });
                                      }
                                    }}
                                    disabled={isRefreshing}
                                  >
                                    +{m}m
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {item.status === 'available' && (
                                <div className="text-center py-4">
                                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                  <p className="text-sm text-muted-foreground mb-3">
                                    Drag student here to start
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    <Input
                                      placeholder="Student ID"
                                      value={studentId}
                                      onChange={(e) =>
                                        setStudentId(e.target.value)
                                      }
                                      disabled={isRefreshing}
                                    />
                                    <Input
                                      placeholder="Student Name"
                                      value={studentName}
                                      onChange={(e) =>
                                        setStudentName(e.target.value)
                                      }
                                      disabled={isRefreshing}
                                    />
                                    <Input
                                      placeholder="Grade Level"
                                      value={gradeLevel}
                                      onChange={(e) =>
                                        setGradeLevel(e.target.value)
                                      }
                                      disabled={isRefreshing}
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (!studentId) return;
                                      startSession({
                                        equipmentId: item.id,
                                        studentId,
                                        timeLimitMinutes:
                                          getTimeLimitByGrade(gradeLevel),
                                      });
                                    }}
                                    className="w-full"
                                    disabled={isRefreshing}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Start Session
                                  </Button>
                                </div>
                              )}

                              {item.status === 'maintenance' && (
                                <div className="text-center py-4">
                                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                                  <p className="text-sm text-muted-foreground">
                                    Under maintenance
                                  </p>
                                </div>
                              )}

                              {item.status === 'offline' && (
                                <div className="text-center py-4">
                                  <WifiOff className="h-8 w-8 mx-auto mb-2 text-red-500" />
                                  <p className="text-sm text-muted-foreground">
                                    Equipment offline
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Equipment Specs */}
                          {item.specs && (
                            <div className="border-t pt-3">
                              <div className="text-xs text-muted-foreground space-y-1">
                                {item.specs.cpu && (
                                  <div>CPU: {item.specs.cpu}</div>
                                )}
                                {item.specs.ram && (
                                  <div>RAM: {item.specs.ram}</div>
                                )}
                                {item.specs.gpu && (
                                  <div>GPU: {item.specs.gpu}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </DroppableEquipment>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Equipment Stats */}
            <div
              className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      // Calculate real utilization from equipment data
                      const computers = equipment.filter(
                        (e) => e.type === 'computer'
                      );
                      const gaming = equipment.filter(
                        (e) => e.type === 'gaming'
                      );
                      const avr = equipment.filter((e) => e.type === 'avr');

                      const computerInUse = computers.filter(
                        (e) => e.status === 'in-use'
                      ).length;
                      const gamingInUse = gaming.filter(
                        (e) => e.status === 'in-use'
                      ).length;
                      const avrInUse = avr.filter(
                        (e) => e.status === 'in-use'
                      ).length;

                      const computerUtil =
                        computers.length > 0
                          ? Math.round((computerInUse / computers.length) * 100)
                          : 0;
                      const gamingUtil =
                        gaming.length > 0
                          ? Math.round((gamingInUse / gaming.length) * 100)
                          : 0;
                      const avrUtil =
                        avr.length > 0
                          ? Math.round((avrInUse / avr.length) * 100)
                          : 0;

                      return (
                        <>
                          <div className="flex justify-between">
                            <span>
                              Computer Utilization ({computerInUse}/
                              {computers.length})
                            </span>
                            <span className="font-medium">{computerUtil}%</span>
                          </div>
                          <Progress value={computerUtil} className="h-2" />

                          <div className="flex justify-between">
                            <span>
                              Gaming Utilization ({gamingInUse}/{gaming.length})
                            </span>
                            <span className="font-medium">{gamingUtil}%</span>
                          </div>
                          <Progress value={gamingUtil} className="h-2" />

                          <div className="flex justify-between">
                            <span>
                              AVR Utilization ({avrInUse}/{avr.length})
                            </span>
                            <span className="font-medium">{avrUtil}%</span>
                          </div>
                          <Progress value={avrUtil} className="h-2" />
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Time Limits by Grade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Primary (K-3)</span>
                      <Badge variant="outline">15 minutes</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Grade School (4-6)</span>
                      <Badge variant="outline">30 minutes</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Junior High (7-10)</span>
                      <Badge variant="outline">45 minutes</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Senior High (11-12)</span>
                      <Badge variant="outline">60 minutes</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar - Active Students */}
          <div className="lg:col-span-1">
            <Card className="h-full sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {activePatrons.length + assignedStudents.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Drag to assign or move between rooms
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-300px)] px-4 pb-4">
                  {/* Available Students Section */}
                  {activePatrons.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Available
                        </span>
                        <Badge variant="outline" className="text-xs h-5">
                          {activePatrons.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {activePatrons.map((patron) => (
                          <DraggableStudent
                            key={patron.id}
                            id={patron.id}
                            student={patron}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Students in Rooms Section */}
                  {assignedStudents.length > 0 && (
                    <div
                      className={
                        activePatrons.length > 0 ? 'pt-4 mt-4 border-t' : 'pt-2'
                      }
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          In Rooms
                        </span>
                        <Badge
                          variant="default"
                          className="text-xs h-5 bg-blue-500"
                        >
                          {assignedStudents.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {assignedStudents.map((student) => (
                          <DraggableStudent
                            key={student.id}
                            id={student.id}
                            student={student}
                            isAssigned
                            equipmentName={student.equipmentName}
                            remainingMinutes={student.remainingMinutes}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {activePatrons.length === 0 &&
                    assignedStudents.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No active students found.
                        <br />
                        Scan students at the entrance to see them here.
                      </div>
                    )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragId && draggedStudent ? (
          <div className="opacity-90 rotate-3 cursor-grabbing">
            <Card className="w-64 shadow-xl border-primary">
              <CardContent className="p-3 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-primary" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium text-sm truncate">
                    {draggedStudent.studentName}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {draggedStudent.gradeLevel}
                    </Badge>
                    <span className="truncate">{draggedStudent.studentId}</span>
                  </div>
                  {'equipmentName' in draggedStudent && (
                    <div className="text-[10px] text-blue-500 mt-0.5">
                      📍 {(draggedStudent as AssignedStudent).equipmentName}
                    </div>
                  )}
                </div>
                <User className="h-4 w-4 text-primary" />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>

      {/* Add Equipment/Room Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Room/Equipment
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Computer Station 1, Discussion Room A"
                value={newEquipment.name}
                onChange={(e) =>
                  setNewEquipment({ ...newEquipment, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Type</Label>
              <Select
                value={newEquipment.category}
                onValueChange={(value) =>
                  setNewEquipment({ ...newEquipment, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="computer">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Computer
                    </div>
                  </SelectItem>
                  <SelectItem value="gaming">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4" />
                      Gaming Station
                    </div>
                  </SelectItem>
                  <SelectItem value="avr">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      AVR/Equipment
                    </div>
                  </SelectItem>
                  <SelectItem value="room">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Discussion Room
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="serial">Serial Number (Optional)</Label>
              <Input
                id="serial"
                placeholder="e.g., SN-12345"
                value={newEquipment.serial_number}
                onChange={(e) =>
                  setNewEquipment({
                    ...newEquipment,
                    serial_number: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="Any additional notes"
                value={newEquipment.notes}
                onChange={(e) =>
                  setNewEquipment({ ...newEquipment, notes: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isAddingEquipment}
            >
              Cancel
            </Button>
            <Button onClick={handleAddEquipment} disabled={isAddingEquipment}>
              {isAddingEquipment ? 'Adding...' : 'Add Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{equipmentToDelete?.name}"? This
              action cannot be undone. All session history for this room will
              also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEquipment}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Room Management Settings</DialogTitle>
          </DialogHeader>
          {isLoadingSettings ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading settings...
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">
                  Session Time Limits by Grade Level (minutes)
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <Label htmlFor="primary-limit" className="flex-1">
                      Primary (K-3)
                    </Label>
                    <Input
                      id="primary-limit"
                      type="number"
                      min={5}
                      max={120}
                      value={sessionLimits.PRIMARY}
                      onChange={(e) =>
                        setSessionLimits((prev) => ({
                          ...prev,
                          PRIMARY: parseInt(e.target.value) || 15,
                        }))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <Label htmlFor="grade-school-limit" className="flex-1">
                      Grade School (4-6)
                    </Label>
                    <Input
                      id="grade-school-limit"
                      type="number"
                      min={5}
                      max={120}
                      value={sessionLimits.GRADE_SCHOOL}
                      onChange={(e) =>
                        setSessionLimits((prev) => ({
                          ...prev,
                          GRADE_SCHOOL: parseInt(e.target.value) || 30,
                        }))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <Label htmlFor="junior-high-limit" className="flex-1">
                      Junior High (7-10)
                    </Label>
                    <Input
                      id="junior-high-limit"
                      type="number"
                      min={5}
                      max={120}
                      value={sessionLimits.JUNIOR_HIGH}
                      onChange={(e) =>
                        setSessionLimits((prev) => ({
                          ...prev,
                          JUNIOR_HIGH: parseInt(e.target.value) || 45,
                        }))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <Label htmlFor="senior-high-limit" className="flex-1">
                      Senior High (11-12)
                    </Label>
                    <Input
                      id="senior-high-limit"
                      type="number"
                      min={5}
                      max={120}
                      value={sessionLimits.SENIOR_HIGH}
                      onChange={(e) =>
                        setSessionLimits((prev) => ({
                          ...prev,
                          SENIOR_HIGH: parseInt(e.target.value) || 60,
                        }))
                      }
                      className="w-20 text-center"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Time limits are automatically applied based on the student's
                  grade level when starting a session.
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(false)}
              disabled={isSavingSettings}
            >
              Cancel
            </Button>
            <Button
              onClick={saveSessionLimits}
              disabled={isSavingSettings || isLoadingSettings}
            >
              {isSavingSettings ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

export default EquipmentDashboard;
