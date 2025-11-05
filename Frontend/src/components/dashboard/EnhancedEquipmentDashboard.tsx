import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useMobileOptimization,
  useTouchOptimization,
  getResponsiveClasses,
} from '@/hooks/useMobileOptimization';
import { useAppStore } from '@/store/useAppStore';
import { DashboardCardSkeleton } from '@/components/LoadingStates';
import {
  Monitor,
  Gamepad2,
  Cpu,
  Play,
  Square,
  RotateCcw,
  CheckCircle,
  Clock,
  User,
  WifiOff,
  Calendar,
  Wrench,
  TrendingUp,
  Search,
  Plus,
  Edit,
  MapPin,
  Tag,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface EquipmentItem {
  id: string;
  equipmentId: string;
  name: string;
  type: string;
  status:
    | 'AVAILABLE'
    | 'IN_USE'
    | 'MAINTENANCE'
    | 'OUT_OF_ORDER'
    | 'RESERVED'
    | 'RETIRED';
  location: string;
  conditionRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  maxTimeMinutes: number;
  requiresSupervision: boolean;
  description?: string;
  category?: string;
  specifications?: Record<string, any>;
  purchaseDate?: string;
  purchaseCost?: number;
  serialNumber?: string;
  assetTag?: string;
  warrantyExpiry?: string;
  nextMaintenance?: string;
  totalUsageHours: number;
  tags?: string[];
  currentSession?: {
    id: string;
    studentId: string;
    studentName: string;
    startTime: string;
    timeLimitMinutes: number;
    remainingMinutes: number;
  };
  upcomingReservations?: Array<{
    id: string;
    studentName: string;
    startTime: string;
    endTime: string;
  }>;
  pendingMaintenance?: Array<{
    id: string;
    type: string;
    priority: string;
    scheduledDate: string;
  }>;
}

interface EquipmentMetrics {
  totalEquipment: number;
  available: number;
  inUse: number;
  maintenance: number;
  reserved: number;
  outOfOrder: number;
  utilizationRate: number;
  averageSessionLength: number;
  totalUsageHours: number;
  maintenancePending: number;
  upcomingMaintenance: number;
  equipmentByType: Array<{
    type: string;
    count: number;
    utilization: number;
  }>;
  equipmentByCondition: Array<{
    condition: string;
    count: number;
  }>;
  topUsedEquipment: Array<{
    equipmentId: string;
    name: string;
    usageHours: number;
    sessions: number;
  }>;
}

export function EnhancedEquipmentDashboard() {
  // Mobile optimization
  const mobileState = useMobileOptimization();
  const { isMobile, isTablet: _isTablet } = mobileState;
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  // State management
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [metrics, setMetrics] = useState<EquipmentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] =
    useState<EquipmentItem | null>(null);
  const isOnline = useAppStore((state) => state.isOnline);

  // Mock data for development
  const mockEquipment: EquipmentItem[] = [
    {
      id: '1',
      equipmentId: 'PC01',
      name: 'Computer Station 1',
      type: 'COMPUTER',
      status: 'IN_USE',
      location: 'Main Area - Station A1',
      conditionRating: 'EXCELLENT',
      maxTimeMinutes: 60,
      requiresSupervision: false,
      category: 'Computer Workstation',
      specifications: {
        cpu: 'Intel i5-12400',
        ram: '16GB',
        gpu: 'Integrated',
        storage: '512GB SSD',
      },
      purchaseDate: '2023-01-15',
      purchaseCost: 899.99,
      assetTag: 'IT-001-PC',
      warrantyExpiry: '2025-01-15',
      nextMaintenance: '2024-02-01',
      totalUsageHours: 1250.5,
      tags: ['productivity', 'research', 'homework'],
      currentSession: {
        id: 'session1',
        studentId: 'STU001',
        studentName: 'Juan Dela Cruz',
        startTime: '2024-01-20T14:30:00Z',
        timeLimitMinutes: 60,
        remainingMinutes: 25,
      },
      upcomingReservations: [
        {
          id: 'res1',
          studentName: 'Maria Santos',
          startTime: '2024-01-20T16:00:00Z',
          endTime: '2024-01-20T17:00:00Z',
        },
      ],
    },
    {
      id: '2',
      equipmentId: 'PC02',
      name: 'Computer Station 2',
      type: 'COMPUTER',
      status: 'AVAILABLE',
      location: 'Main Area - Station A2',
      conditionRating: 'GOOD',
      maxTimeMinutes: 60,
      requiresSupervision: false,
      category: 'Computer Workstation',
      specifications: {
        cpu: 'Intel i5-12400',
        ram: '16GB',
        gpu: 'Integrated',
        storage: '512GB SSD',
      },
      purchaseDate: '2023-01-15',
      purchaseCost: 899.99,
      assetTag: 'IT-002-PC',
      warrantyExpiry: '2025-01-15',
      totalUsageHours: 980.2,
      tags: ['productivity', 'research', 'homework'],
    },
    {
      id: '3',
      equipmentId: 'PS01',
      name: 'PlayStation 5 Station 1',
      type: 'GAMING',
      status: 'MAINTENANCE',
      location: 'Gaming Area - Console 1',
      conditionRating: 'FAIR',
      maxTimeMinutes: 45,
      requiresSupervision: true,
      category: 'Gaming Console',
      specifications: {
        console: 'PS5',
        storage: '825GB SSD',
        accessories: 'DualSense Controller',
      },
      purchaseDate: '2022-11-01',
      purchaseCost: 499.99,
      assetTag: 'IT-003-PS',
      nextMaintenance: '2024-01-25',
      totalUsageHours: 450.8,
      tags: ['gaming', 'entertainment'],
      pendingMaintenance: [
        {
          id: 'maint1',
          type: 'ROUTINE',
          priority: 'NORMAL',
          scheduledDate: '2024-01-25T10:00:00Z',
        },
      ],
    },
    {
      id: '4',
      equipmentId: 'VR01',
      name: 'VR Station - Oculus Quest 2',
      type: 'AVR',
      status: 'RESERVED',
      location: 'AVR Room - Station 1',
      conditionRating: 'EXCELLENT',
      maxTimeMinutes: 30,
      requiresSupervision: true,
      category: 'Virtual Reality',
      specifications: {
        headset: 'Oculus Quest 2',
        controllers: 'Touch Controllers',
        space: '3m x 3m',
      },
      purchaseDate: '2023-06-01',
      purchaseCost: 299.99,
      assetTag: 'IT-004-VR',
      warrantyExpiry: '2024-06-01',
      totalUsageHours: 125.3,
      tags: ['vr', 'immersive', 'educational'],
      upcomingReservations: [
        {
          id: 'res2',
          studentName: 'Carlos Rodriguez',
          startTime: '2024-01-20T15:00:00Z',
          endTime: '2024-01-20T15:30:00Z',
        },
      ],
    },
  ];

  const mockMetrics: EquipmentMetrics = {
    totalEquipment: 25,
    available: 12,
    inUse: 8,
    maintenance: 3,
    reserved: 2,
    outOfOrder: 0,
    utilizationRate: 68.5,
    averageSessionLength: 42.3,
    totalUsageHours: 3847.2,
    maintenancePending: 5,
    upcomingMaintenance: 8,
    equipmentByType: [
      { type: 'COMPUTER', count: 15, utilization: 75.2 },
      { type: 'GAMING', count: 6, utilization: 58.3 },
      { type: 'AVR', count: 4, utilization: 82.1 },
    ],
    equipmentByCondition: [
      { condition: 'EXCELLENT', count: 18 },
      { condition: 'GOOD', count: 5 },
      { condition: 'FAIR', count: 2 },
      { condition: 'POOR', count: 0 },
      { condition: 'DAMAGED', count: 0 },
    ],
    topUsedEquipment: [
      {
        equipmentId: 'PC01',
        name: 'Computer Station 1',
        usageHours: 1250.5,
        sessions: 847,
      },
      {
        equipmentId: 'PC02',
        name: 'Computer Station 2',
        usageHours: 1187.3,
        sessions: 756,
      },
      {
        equipmentId: 'PC03',
        name: 'Computer Station 3',
        usageHours: 1098.7,
        sessions: 692,
      },
    ],
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, these would be API calls
        // const equipmentData = await api.getEquipment()
        // const metricsData = await api.getEquipmentMetrics()
        setEquipment(mockEquipment);
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Error loading equipment data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter equipment based on _search and filters
  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.equipmentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      selectedFilter === 'all' || item.status === selectedFilter;
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesLocation =
      selectedLocation === 'all' || item.location === selectedLocation;

    return matchesSearch && matchesFilter && matchesCategory && matchesLocation;
  });

  // Status helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-500 dark:bg-green-400';
      case 'IN_USE':
        return 'bg-blue-500 dark:bg-blue-400';
      case 'MAINTENANCE':
        return 'bg-yellow-500 dark:bg-yellow-400';
      case 'OUT_OF_ORDER':
        return 'bg-red-500 dark:bg-red-400';
      case 'RESERVED':
        return 'bg-purple-500 dark:bg-purple-400';
      case 'RETIRED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Available
          </Badge>
        );
      case 'IN_USE':
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            In Use
          </Badge>
        );
      case 'MAINTENANCE':
        return <Badge variant="secondary">Maintenance</Badge>;
      case 'OUT_OF_ORDER':
        return <Badge variant="destructive">Out of Order</Badge>;
      case 'RESERVED':
        return (
          <Badge
            variant="default"
            className="bg-purple-500 hover:bg-purple-600"
          >
            Reserved
          </Badge>
        );
      case 'RETIRED':
        return <Badge variant="outline">Retired</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'EXCELLENT':
        return 'text-green-600 dark:text-green-400';
      case 'GOOD':
        return 'text-blue-600 dark:text-blue-400';
      case 'FAIR':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'POOR':
        return 'text-orange-600 dark:text-orange-400';
      case 'DAMAGED':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'COMPUTER':
        return <Monitor className="h-5 w-5" />;
      case 'GAMING':
        return <Gamepad2 className="h-5 w-5" />;
      case 'AVR':
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

  // Action handlers
  const handleStartSession = (equipment: EquipmentItem) => {
    // Implementation for starting equipment session
    console.debug('Starting session for equipment:', equipment.id);
  };

  const handleEndSession = (sessionId: string) => {
    // Implementation for ending equipment session
    console.debug('Ending session:', sessionId);
  };

  const handleScheduleMaintenance = (equipment: EquipmentItem) => {
    setSelectedEquipment(equipment);
    setShowMaintenanceDialog(true);
  };

  const handleCreateReservation = (equipment: EquipmentItem) => {
    setSelectedEquipment(equipment);
    setShowReservationDialog(true);
  };

  const handleRefresh = () => {
    // Implementation for refreshing equipment data
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className={getResponsiveClasses('space-y-6', mobileState)}>
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>
    );
  }

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
            Monitor and manage library equipment, reservations, and maintenance.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent
              className={getResponsiveClasses('max-w-2xl', mobileState)}
            >
              <DialogHeader>
                <DialogTitle>Add New Equipment</DialogTitle>
                <DialogDescription>
                  Add a new piece of equipment to the library inventory.
                </DialogDescription>
              </DialogHeader>
              {/* Equipment creation form would go here */}
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Equipment creation form will be implemented here.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Overview */}
      {metrics && (
        <div
          className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Equipment
              </CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalEquipment}</div>
              <p className="text-xs text-muted-foreground">
                All equipment items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics.available}
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
                {metrics.inUse}
              </div>
              <p className="text-xs text-muted-foreground">Active sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics.utilizationRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Overall utilization
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection Status */}
      {!isOnline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Equipment changes will be queued and
            synced when connection is restored.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and _Search */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="_Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger
              className={getResponsiveClasses('w-full lg:w-40', mobileState)}
            >
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="IN_USE">In Use</SelectItem>
              <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
              <SelectItem value="RESERVED">Reserved</SelectItem>
              <SelectItem value="OUT_OF_ORDER">Out of Order</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger
              className={getResponsiveClasses('w-full lg:w-40', mobileState)}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Computer Workstation">Computers</SelectItem>
              <SelectItem value="Gaming Console">Gaming</SelectItem>
              <SelectItem value="Virtual Reality">VR/AVR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Equipment List */}
      <Tabs defaultValue="all" className={`space-y-${isMobile ? '3' : '4'}`}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Equipment</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="in-use">In Use</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <Badge variant="outline">{filteredEquipment.length} items</Badge>
        </div>

        <TabsContent value="all" className={`space-y-${isMobile ? '3' : '4'}`}>
          <div
            className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}
          >
            {filteredEquipment.map((item) => (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getEquipmentIcon(item.type)}
                      <div>
                        <CardTitle className="text-sm">{item.name}</CardTitle>
                        <CardDescription>
                          ID: {item.equipmentId}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
                      ></div>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Equipment Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <div className="flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {item.location}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Condition:</span>
                      <div
                        className={`font-medium ${getConditionColor(item.conditionRating)}`}
                      >
                        {item.conditionRating}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Time:</span>
                      <div className="font-medium">
                        {item.maxTimeMinutes} min
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Usage:</span>
                      <div className="font-medium">
                        {item.totalUsageHours.toFixed(1)} hrs
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          <Tag className="h-2 w-2 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Current Session */}
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
                          value={
                            ((item.currentSession.timeLimitMinutes -
                              item.currentSession.remainingMinutes) /
                              item.currentSession.timeLimitMinutes) *
                            100
                          }
                          className="mt-2 h-2"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            handleEndSession(item.currentSession?.id || '')
                          }
                          className="flex-1"
                        >
                          <Square className="h-3 w-3 mr-1" />
                          End Session
                        </Button>
                        <Button size="sm" variant="outline">
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {item.status === 'AVAILABLE' && (
                        <div className="text-center py-4">
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Equipment is ready for use
                          </p>
                          <Button
                            size="sm"
                            onClick={() => handleStartSession(item)}
                            className="w-full"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start Session
                          </Button>
                        </div>
                      )}

                      {item.status === 'RESERVED' &&
                        item.upcomingReservations && (
                          <div className="p-3 bg-purple-10 dark:bg-purple-5 rounded-lg border border-purple-20 dark:border-purple-10">
                            <div className="text-sm">
                              <div className="font-medium mb-2">
                                Upcoming Reservations
                              </div>
                              {item.upcomingReservations.map(
                                (reservation, index) => (
                                  <div
                                    key={index}
                                    className="text-muted-foreground"
                                  >
                                    {reservation.studentName} -{' '}
                                    {new Date(
                                      reservation.startTime
                                    ).toLocaleTimeString()}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}

                      {item.status === 'MAINTENANCE' && (
                        <div className="text-center py-4">
                          <Wrench className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <p className="text-sm text-muted-foreground mb-2">
                            Under maintenance
                          </p>
                          {item.nextMaintenance && (
                            <p className="text-xs text-muted-foreground">
                              Next maintenance:{' '}
                              {new Date(
                                item.nextMaintenance
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateReservation(item)}
                          className="flex-1"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          Reserve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleMaintenance(item)}
                        >
                          <Wrench className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2 border-t">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="analytics"
          className={`space-y-${isMobile ? '3' : '4'}`}
        >
          {metrics && (
            <div
              className={`grid gap-${isMobile ? '3' : '4'} ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}
            >
              {/* Usage Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usage Statistics</CardTitle>
                  <CardDescription>
                    Equipment utilization by type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.equipmentByType.map((type, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            {type.type}
                          </span>
                          <span className="text-sm">{type.count} items</span>
                        </div>
                        <Progress value={type.utilization} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          {type.utilization.toFixed(1)}% utilization
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Equipment Condition */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Equipment Condition</CardTitle>
                  <CardDescription>
                    Condition rating distribution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.equipmentByCondition.map((condition, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium">
                          {condition.condition}
                        </span>
                        <Badge variant="outline">{condition.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Used Equipment */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Most Used Equipment</CardTitle>
                  <CardDescription>
                    Top equipment by usage hours
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.topUsedEquipment.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.equipmentId}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {item.usageHours.toFixed(1)} hrs
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.sessions} sessions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Maintenance Dialog */}
      <Dialog
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
      >
        <DialogContent
          className={getResponsiveClasses('max-w-2xl', mobileState)}
        >
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
            <DialogDescription>
              Schedule maintenance for {selectedEquipment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Maintenance scheduling form will be implemented here.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reservation Dialog */}
      <Dialog
        open={showReservationDialog}
        onOpenChange={setShowReservationDialog}
      >
        <DialogContent
          className={getResponsiveClasses('max-w-2xl', mobileState)}
        >
          <DialogHeader>
            <DialogTitle>Create Reservation</DialogTitle>
            <DialogDescription>
              Reserve {selectedEquipment?.name} for future use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Reservation form will be implemented here.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EnhancedEquipmentDashboard;
