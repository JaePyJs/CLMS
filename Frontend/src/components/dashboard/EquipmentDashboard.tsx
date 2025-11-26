import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { DraggableStudent } from './equipment/DraggableStudent';
import { DroppableEquipment } from './equipment/DroppableEquipment';
import { toast } from 'sonner';

interface ActivePatron {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string | number;
  purpose: string;
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

  // Drag and Drop State
  const [activePatrons, setActivePatrons] = useState<ActivePatron[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedStudent, setDraggedStudent] = useState<ActivePatron | null>(
    null
  );

  const { equipment: equipmentData, isOnline } = useAppStore();
  const setEquipment = useAppStore((state) => state.setEquipment);

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

  const fetchActivePatrons = async () => {
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
  };

  useEffect(() => {
    fetchActivePatrons();
    const interval = setInterval(fetchActivePatrons, 30000);
    return () => clearInterval(interval);
  }, [equipmentData]); // Re-fetch when equipment data changes (e.g. session starts)

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
    const student = activePatrons.find((p) => p.id === active.id);
    if (student) setDraggedStudent(student);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setDraggedStudent(null);

    console.log('🎯 Drag ended:', { activeId: active?.id, overId: over?.id });

    if (over && active) {
      const equipmentId = over.id as string;
      const patronId = active.id as string;

      const patron = activePatrons.find((p) => p.id === patronId);
      const targetEquipment = equipment.find((e) => e.id === equipmentId);

      console.log('📋 Drag details:', {
        equipmentId,
        patronId,
        patron: patron
          ? {
              id: patron.id,
              studentId: patron.studentId,
              studentName: patron.studentName,
              gradeLevel: patron.gradeLevel,
            }
          : 'NOT FOUND',
        targetEquipment: targetEquipment
          ? {
              id: targetEquipment.id,
              name: targetEquipment.name,
              status: targetEquipment.status,
            }
          : 'NOT FOUND',
      });

      if (!patron) {
        console.error('❌ Patron not found in activePatrons list');
        toast.error('Student not found');
        return;
      }

      if (!targetEquipment) {
        console.error('❌ Equipment not found in equipment list');
        toast.error('Equipment not found');
        return;
      }

      if (targetEquipment.status !== 'available') {
        console.warn('⚠️ Equipment is not available:', targetEquipment.status);
        toast.error(`Equipment is ${targetEquipment.status}, not available`);
        return;
      }

      const sessionData = {
        equipmentId: equipmentId,
        studentId: patron.studentId,
        timeLimitMinutes: getTimeLimitByGrade(patron.gradeLevel),
      };

      console.log('🚀 Starting session with data:', sessionData);

      // Start session
      startSession(sessionData);
      toast.success(
        `Assigning ${patron.studentName} to ${targetEquipment.name}`
      );

      // Optimistically remove from list
      setActivePatrons((prev) => prev.filter((p) => p.id !== patronId));
    } else {
      console.log('ℹ️ Drag cancelled or invalid drop target');
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Room Management
            </h2>
            <p className="text-muted-foreground">
              Monitor and manage library rooms and discussion areas.
            </p>
          </div>
          <div className="flex items-center space-x-2">
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
              <Clock className="h-4 w-4 mr-2" />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" disabled={isRefreshing}>
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Rooms
                  </CardTitle>
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{equipment.length}</div>
                  <p className="text-xs text-muted-foreground">All rooms</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Available
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {equipment.filter((e) => e.status === 'available').length}
                  </div>
                  <p className="text-xs text-muted-foreground">Ready for use</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Use</CardTitle>
                  <User className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {equipment.filter((e) => e.status === 'in-use').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Issues</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
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
                      <Card className="relative h-full">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getEquipmentIcon(item.type)}
                              <CardTitle className="text-sm">
                                {item.name}
                              </CardTitle>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
                              ></div>
                              {getStatusBadge(item.status)}

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isRefreshing}
                                  >
                                    <History className="h-3 w-3 mr-1" />
                                    History
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Session History – {item.name}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-2 text-sm">
                                    <div className="text-muted-foreground">
                                      Session history not available
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
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
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                                <div className="flex items-center gap-1">
                                  {[15, 30, 45, 60].map((m) => (
                                    <Button
                                      key={`ext-${item.id}-${m}`}
                                      size="sm"
                                      variant="outline"
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
                    <div className="flex justify-between">
                      <span>Computer Utilization</span>
                      <span className="font-medium">75%</span>
                    </div>
                    <Progress value={75} className="h-2" />

                    <div className="flex justify-between">
                      <span>Gaming Utilization</span>
                      <span className="font-medium">50%</span>
                    </div>
                    <Progress value={50} className="h-2" />

                    <div className="flex justify-between">
                      <span>AVR Utilization</span>
                      <span className="font-medium">25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
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
                  Active Students
                </CardTitle>
                <CardDescription>Drag to assign to equipment</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-300px)] px-4 pb-4">
                  {activePatrons.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No active students found.
                      <br />
                      Scan students at the entrance to see them here.
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {activePatrons.map((patron) => (
                        <DraggableStudent
                          key={patron.id}
                          id={patron.id}
                          student={patron}
                        />
                      ))}
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
                </div>
                <User className="h-4 w-4 text-primary" />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default EquipmentDashboard;
