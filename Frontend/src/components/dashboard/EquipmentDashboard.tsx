import { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useEndSession } from '@/hooks/api-hooks';
import { useAppStore } from '@/store/useAppStore';
import { offlineActions } from '@/lib/offline-queue';

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
} from 'lucide-react';

interface EquipmentItem {
  id: string;
  type: 'computer' | 'gaming' | 'avr';
  name: string;
  status: 'available' | 'in-use' | 'maintenance' | 'offline';
  currentSession?: {
    id: string;
    studentId: string;
    studentName: string;
    startTime: Date;
    timeLimitMinutes: number;
    remainingMinutes: number;
  };
  specs?: {
    cpu?: string;
    ram?: string;
    gpu?: string;
  };
}

export function EquipmentDashboard() {
  // Mobile optimization
  const mobileState = useMobileOptimization();
  const { isMobile } = mobileState;
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [devStudentId, setDevStudentId] = useState<string>('S-0001');
  const [devStudentName, setDevStudentName] = useState<string>('Alice Example');
  const [devGradeLevel, setDevGradeLevel] = useState<string>('Grade 5');
  const [devHistory, setDevHistory] = useState<Record<string, { studentName: string; startTime: Date; endTime: Date; durationMinutes: number }[]>>({});
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      const raw = localStorage.getItem('clms-equipment-dev-history');
      if (raw) {
        const parsed = JSON.parse(raw);
        const revive = Object.fromEntries(Object.entries(parsed).map(([k, arr]: any) => [k, (arr || []).map((h: any) => ({ studentName: String(h.studentName || ''), startTime: new Date(h.startTime), endTime: new Date(h.endTime), durationMinutes: Number(h.durationMinutes || 0) }))]));
        setDevHistory(revive as any);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      const serializable = Object.fromEntries(Object.entries(devHistory).map(([k, arr]) => [k, (arr || []).map((h) => ({ ...h, startTime: new Date(h.startTime).toISOString(), endTime: new Date(h.endTime).toISOString() }))]));
      localStorage.setItem('clms-equipment-dev-history', JSON.stringify(serializable));
    } catch {}
  }, [devHistory]);
  const { equipment: equipmentData, isOnline } = useAppStore();
  const setEquipment = useAppStore((state) => state.setEquipment);
  const { mutate: endSession } = useEndSession();

  useEffect(() => {
    const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development') || import.meta.env.DEV;
    if (!isDevApp) return;
    const interval = setInterval(() => {
      setEquipment((prev: any[]) =>
        (prev || []).map((e: any) => {
          const cs = e.currentSession;
          if (e.status === 'in-use' && cs && typeof cs.remainingMinutes === 'number') {
            const next = Math.max(0, Number(cs.remainingMinutes) - 1);
            if (next === 0) {
              return { ...e, status: 'available', currentSession: undefined };
            }
            return { ...e, currentSession: { ...cs, remainingMinutes: next } };
          }
          return e;
        })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [setEquipment]);

  // Mock equipment data for now
  const mockEquipment: EquipmentItem[] = [
    {
      id: 'PC01',
      type: 'computer',
      name: 'Computer Station 1',
      status: 'in-use',
      currentSession: {
        id: 'session1',
        studentId: 'STU001',
        studentName: 'Juan Dela Cruz',
        startTime: new Date(Date.now() - 25 * 60000), // 25 minutes ago
        timeLimitMinutes: 30,
        remainingMinutes: 5,
      },
      specs: { cpu: 'Intel i5', ram: '8GB', gpu: 'Integrated' },
    },
    {
      id: 'PC02',
      type: 'computer',
      name: 'Computer Station 2',
      status: 'available',
      specs: { cpu: 'Intel i5', ram: '8GB', gpu: 'Integrated' },
    },
    {
      id: 'PS01',
      type: 'gaming',
      name: 'PlayStation 1',
      status: 'in-use',
      currentSession: {
        id: 'session2',
        studentId: 'STU002',
        studentName: 'Maria Santos',
        startTime: new Date(Date.now() - 40 * 60000), // 40 minutes ago
        timeLimitMinutes: 45,
        remainingMinutes: 5,
      },
    },
    {
      id: 'PS02',
      type: 'gaming',
      name: 'PlayStation 2',
      status: 'available',
    },
    {
      id: 'AVR01',
      type: 'avr',
      name: 'VR Station 1',
      status: 'maintenance',
    },
  ];

  const equipment = Array.isArray(equipmentData) && equipmentData.length > 0 ? equipmentData : mockEquipment;

  // Filter equipment based on selected filter
  const filteredEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => {
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
  });

  const handleEndSession = async (sessionId: string) => {
    const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development');
    if (isDevApp) {
      const endedItem = equipment.find((i) => i.currentSession && i.currentSession.id === sessionId);
      if (endedItem && endedItem.currentSession) {
        const end = new Date();
        const start = endedItem.currentSession.startTime;
        const duration = Math.max(1, Math.round((end.getTime() - new Date(start).getTime()) / 60000));
        setDevHistory((prev) => {
          const arr = prev[endedItem.id] ? [...prev[endedItem.id]] : [];
          arr.unshift({ studentName: endedItem.currentSession!.studentName, startTime: new Date(start), endTime: end, durationMinutes: duration });
          return { ...prev, [endedItem.id]: arr.slice(0, 10) };
        });
      }
      const updated = equipment.map((item) => (item.currentSession && item.currentSession.id === sessionId ? { ...item, status: 'available', currentSession: undefined } : item));
      setEquipment(updated as any);
      return;
    }
    if (isOnline) {
      endSession(sessionId);
    } else {
      await offlineActions.endSession(sessionId);
    }
  };

  const handleEndAllSessions = () => {
    const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development');
    if (!isDevApp) return;
    const now = new Date();
    setEquipment(prev => (prev || []).map((item) => {
      const cs = item.currentSession;
      if (item.status === 'in-use' && cs) {
        const duration = Math.max(1, Math.round((now.getTime() - new Date(cs.startTime).getTime()) / 60000));
        setDevHistory((prevHist) => {
          const arr = prevHist[item.id] ? [...prevHist[item.id]] : [];
          arr.unshift({ studentName: cs.studentName, startTime: new Date(cs.startTime), endTime: now, durationMinutes: duration });
          return { ...prevHist, [item.id]: arr.slice(0, 10) };
        });
        return { ...item, status: 'available', currentSession: undefined };
      }
      return item;
    }));
  };

  const getDevTimeLimitByGrade = (grade: string): number => {
    const g = (grade || '').toLowerCase();
    if (g.includes('grade 1') || g.includes('grade 2') || g.includes('grade 3')) return 15;
    if (g.includes('grade 4') || g.includes('grade 5') || g.includes('grade 6')) return 30;
    if (g.includes('grade 7') || g.includes('grade 8') || g.includes('grade 9')) return 45;
    if (g.includes('grade 10') || g.includes('grade 11') || g.includes('grade 12')) return 60;
    return 30;
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
    <div
      className={getResponsiveClasses('space-y-6', mobileState)}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Equipment Management
          </h2>
          <p className="text-muted-foreground">
            Monitor and manage library equipment and computer stations.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 1000); }} disabled={isRefreshing}>
            <Clock className="h-4 w-4 mr-2" />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" disabled={isRefreshing}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div
        className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-4'}`}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Equipment
            </CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipment.length}</div>
            <p className="text-xs text-muted-foreground">All stations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
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
            <p className="text-xs text-muted-foreground">Active sessions</p>
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
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status */}
      {!isOnline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Session changes will be queued and synced
            when connection is restored.
          </AlertDescription>
        </Alert>
      )}

      {/* Equipment List */}
      <Tabs defaultValue="all" className={`space-y-${isMobile ? '3' : '4'}`}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" onClick={() => setSelectedFilter('all')} disabled={isRefreshing}>
              All Equipment
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
            <Badge variant="outline">{filteredEquipment.length} items</Badge>
          </div>
        </div>

        <TabsContent value="all" className={`space-y-${isMobile ? '3' : '4'}`}>
          <div
            className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`}
          >
            {filteredEquipment.map((item: EquipmentItem) => (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getEquipmentIcon(item.type)}
          <CardTitle className="text-sm">{item.name}</CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
          ></div>
          {getStatusBadge(item.status)}
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" onClick={handleEndAllSessions} disabled={isRefreshing}>
              End All Sessions
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isRefreshing}>
                <History className="h-3 w-3 mr-1" />
                History
              </Button>
            </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Session History – {item.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2 text-sm">
                            {(devHistory[item.id] || []).length === 0 ? (
                              <div className="text-muted-foreground">No previous sessions</div>
                            ) : (
                              (devHistory[item.id] || []).map((h, idx) => (
                                <div key={`${item.id}-hist-${idx}`} className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{h.studentName}</div>
                                    <div className="text-xs text-muted-foreground">{new Date(h.startTime).toLocaleTimeString()} – {new Date(h.endTime).toLocaleTimeString()}</div>
                                  </div>
                                  <Badge variant="outline">{h.durationMinutes}m</Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <CardDescription>ID: {item.id}</CardDescription>
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
                            <span>{item.currentSession.studentName}</span>
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
                          value={getSessionProgress(item.currentSession)}
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
                            const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development');
                            if (isDevApp && item.currentSession) {
                              const updated = equipment.map((e) => {
                                if (e.id === item.id && e.currentSession) {
                                  const add = 10;
                                  const newRemaining = Number(e.currentSession.remainingMinutes) + add;
                                  return {
                                    ...e,
                                    currentSession: { ...e.currentSession, remainingMinutes: newRemaining },
                                  };
                                }
                                return e;
                              });
                              setEquipment(updated as any);
                            }
                          }}
                          disabled={isRefreshing}
                          >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <div className="flex items-center gap-1">
                          {[15,30,45,60].map((m) => (
                            <Button
                              key={`ext-${item.id}-${m}`}
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development');
                                if (isDevApp && item.currentSession) {
                                  const updated = equipment.map((e) => {
                                    if (e.id === item.id && e.currentSession) {
                                      const newRemaining = Number(e.currentSession.remainingMinutes) + m;
                                      return {
                                        ...e,
                                        currentSession: { ...e.currentSession, remainingMinutes: newRemaining },
                                      };
                                    }
                                    return e;
                                  });
                                  setEquipment(updated as any);
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
                            Equipment is ready for use
                          </p>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <Input
                              placeholder="Student ID"
                              value={devStudentId}
                              onChange={(e) => setDevStudentId(e.target.value)}
                              disabled={isRefreshing}
                            />
                            <Input
                              placeholder="Student Name"
                              value={devStudentName}
                              onChange={(e) => setDevStudentName(e.target.value)}
                              disabled={isRefreshing}
                            />
                            <Input
                              placeholder="Grade Level"
                              value={devGradeLevel}
                              onChange={(e) => setDevGradeLevel(e.target.value)}
                              disabled={isRefreshing}
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              const isDevApp = String(import.meta.env.VITE_APP_NAME || '').toLowerCase().includes('development');
                              if (isDevApp) {
                                const updated = equipment.map((e) => {
                                  if (e.id === item.id) {
                                    const tl = getDevTimeLimitByGrade(devGradeLevel);
                                    return {
                                      ...e,
                                      status: 'in-use',
                                      currentSession: {
                                        id: `dev-${Date.now()}`,
                                        studentId: devStudentId || 'DEV-STUDENT',
                                        studentName: devStudentName || 'Dev Student',
                                        startTime: new Date(),
                                        timeLimitMinutes: tl,
                                        remainingMinutes: tl,
                                      },
                                    };
                                  }
                                  return e;
                                });
                                setEquipment(updated as any);
                              }
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
                        {item.specs.cpu && <div>CPU: {item.specs.cpu}</div>}
                        {item.specs.ram && <div>RAM: {item.specs.ram}</div>}
                        {item.specs.gpu && <div>GPU: {item.specs.gpu}</div>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
            <CardTitle className="text-lg">Time Limits by Grade</CardTitle>
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
  );
}

export default EquipmentDashboard;
