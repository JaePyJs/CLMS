import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wifi, Settings, Play, Square, AlertCircle, CheckCircle, XCircle, RefreshCw, Plus, Trash2 } from 'lucide-react';

interface ScannerDevice {
  path: string;
  vendorId: number;
  productId: number;
  product: string;
  manufacturer: string;
  serialNumber?: string;
}

interface ScannerStatus {
  deviceId: string;
  name: string;
  connected: boolean;
  lastScan: Date | null;
  scanCount: number;
  errorCount: number;
  lastError: string | null;
  deviceInfo: ScannerDevice | null;
}

interface ScannerStatistics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  duplicateScans: number;
  invalidScans: number;
  averageProcessingTime: number;
  lastScanTime: Date | null;
  scansByDevice: Map<string, number>;
  scansByType: Map<string, number>;
}

interface ScannerStation {
  id: string;
  name: string;
  location: string;
  description?: string;
  scannerConfigs: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function ScannerManager() {
  const [activeTab, setActiveTab] = useState('devices');
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [connectedScanners, setConnectedScanners] = useState<ScannerStatus[]>([]);
  const [statistics, setStatistics] = useState<ScannerStatistics | null>(null);
  const [stations, setStations] = useState<ScannerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);

  // Form states
  const [newStation, setNewStation] = useState({
    name: '',
    location: '',
    description: '',
  });

  // Fetch scanner data
  const fetchScannerData = async () => {
    try {
      setLoading(true);

      // Fetch devices and status
      const devicesResponse = await fetch('/api/scanner/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (devicesResponse.ok) {
        const data = await devicesResponse.json();
        setDevices(data.data.available || []);
        setConnectedScanners(data.data.connected || []);
      }

      // Fetch statistics
      const statsResponse = await fetch('/api/scanner/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData.data.statistics);
      }

      // Fetch stations
      const stationsResponse = await fetch('/api/scanner/stations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (stationsResponse.ok) {
        const stationsData = await stationsResponse.json();
        setStations(stationsData.data || []);
      }

    } catch (error) {
      console.error('Error fetching scanner data:', error);
      toast.error('Failed to fetch scanner data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScannerData();

    // Set up WebSocket for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'scan_event' ||
          message.type === 'scanner_connected' ||
          message.type === 'scanner_disconnected' ||
          message.type === 'scanner_error') {
        fetchScannerData(); // Refresh data on scanner events
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Connect to a scanner device
  const connectScanner = async (device: ScannerDevice, config: any = {}) => {
    try {
      setConnectingDevice(device.path);

      const response = await fetch('/api/scanner/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          devicePath: device.path,
          vendorId: device.vendorId,
          productId: device.productId,
          name: `${device.manufacturer} ${device.product}`,
          config: {
            bufferSize: 64,
            timeout: 100,
            minLength: 3,
            maxLength: 50,
            beepOnScan: true,
            visualFeedback: true,
            duplicatePrevention: true,
            duplicateWindow: 30 * 60 * 1000,
            ...config,
          },
        }),
      });

      if (response.ok) {
        toast.success('Scanner connected successfully');
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to connect scanner');
      }
    } catch (error) {
      console.error('Error connecting scanner:', error);
      toast.error('Failed to connect scanner');
    } finally {
      setConnectingDevice(null);
    }
  };

  // Disconnect a scanner
  const disconnectScanner = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/scanner/disconnect/${deviceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast.success('Scanner disconnected successfully');
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to disconnect scanner');
      }
    } catch (error) {
      console.error('Error disconnecting scanner:', error);
      toast.error('Failed to disconnect scanner');
    }
  };

  // Toggle scanner enabled state
  const toggleScanner = async (deviceId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/scanner/enable/${deviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        toast.success(`Scanner ${enabled ? 'enabled' : 'disabled'} successfully`);
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update scanner');
      }
    } catch (error) {
      console.error('Error toggling scanner:', error);
      toast.error('Failed to update scanner');
    }
  };

  // Auto-configure scanner
  const autoConfigureScanner = async (device: ScannerDevice) => {
    try {
      setConnectingDevice(device.path);

      const response = await fetch('/api/scanner/auto-configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          devicePath: device.path,
          vendorId: device.vendorId,
          productId: device.productId,
        }),
      });

      if (response.ok) {
        toast.success('Scanner auto-configured and connected successfully');
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to auto-configure scanner');
      }
    } catch (error) {
      console.error('Error auto-configuring scanner:', error);
      toast.error('Failed to auto-configure scanner');
    } finally {
      setConnectingDevice(null);
    }
  };

  // Create new station
  const createStation = async () => {
    try {
      if (!newStation.name || !newStation.location) {
        toast.error('Name and location are required');
        return;
      }

      const response = await fetch('/api/scanner/stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newStation),
      });

      if (response.ok) {
        toast.success('Station created successfully');
        setNewStation({ name: '', location: '', description: '' });
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create station');
      }
    } catch (error) {
      console.error('Error creating station:', error);
      toast.error('Failed to create station');
    }
  };

  // Delete station
  const deleteStation = async (stationId: string) => {
    try {
      const response = await fetch(`/api/scanner/stations/${stationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast.success('Station deleted successfully');
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete station');
      }
    } catch (error) {
      console.error('Error deleting station:', error);
      toast.error('Failed to delete station');
    }
  };

  // Reset statistics
  const resetStatistics = async () => {
    try {
      const response = await fetch('/api/scanner/statistics/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        toast.success('Statistics reset successfully');
        fetchScannerData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reset statistics');
      }
    } catch (error) {
      console.error('Error resetting statistics:', error);
      toast.error('Failed to reset statistics');
    }
  };

  // Format device IDs for display
  const formatDeviceId = (deviceId: string) => {
    return deviceId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scanner Management</h1>
          <p className="text-muted-foreground">
            Manage USB barcode scanners and monitor scan activity
          </p>
        </div>
        <Button onClick={fetchScannerData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Available Devices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wifi className="h-5 w-5 mr-2" />
                  Available Devices ({devices.length})
                </CardTitle>
                <CardDescription>
                  USB barcode scanners detected on this system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No USB scanners detected
                  </p>
                ) : (
                  devices.map((device, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{device.product}</p>
                        <p className="text-sm text-muted-foreground">
                          {device.manufacturer}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          VID: {device.vendorId?.toString(16)}, PID: {device.productId?.toString(16)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => autoConfigureScanner(device)}
                          disabled={connectingDevice === device.path}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Auto
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => connectScanner(device)}
                          disabled={connectingDevice === device.path}
                        >
                          {connectingDevice === device.path ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                          Connect
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Connected Scanners */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Connected Scanners ({connectedScanners.length})
                </CardTitle>
                <CardDescription>
                  Currently active scanner connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {connectedScanners.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No scanners connected
                  </p>
                ) : (
                  connectedScanners.map((scanner) => (
                    <div
                      key={scanner.deviceId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{scanner.name}</p>
                          <Badge variant={scanner.connected ? "default" : "secondary"}>
                            {scanner.connected ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>
                        {scanner.deviceInfo && (
                          <p className="text-sm text-muted-foreground">
                            {scanner.deviceInfo.product}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>Scans: {scanner.scanCount}</span>
                          <span>Errors: {scanner.errorCount}</span>
                          {scanner.lastScan && (
                            <span>Last: {new Date(scanner.lastScan).toLocaleTimeString()}</span>
                          )}
                        </div>
                        {scanner.lastError && (
                          <p className="text-xs text-red-500 mt-1">
                            Error: {scanner.lastError}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleScanner(scanner.deviceId, !true)}
                        >
                          {scanner.connected ? (
                            <Square className="h-4 w-4 mr-1" />
                          ) : (
                            <Play className="h-4 w-4 mr-1" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => disconnectScanner(scanner.deviceId)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Connected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {connectedScanners.filter(s => s.connected).length}
                </div>
                <p className="text-sm text-muted-foreground">
                  of {connectedScanners.length} configured scanners
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {statistics?.totalScans || 0}
                </div>
                <p className="text-sm text-muted-foreground">
                  total scans
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {statistics ? Math.round((statistics.successfulScans / Math.max(statistics.totalScans, 1)) * 100) : 0}%
                </div>
                <p className="text-sm text-muted-foreground">
                  scan success rate
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Scanner Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {connectedScanners.map((scanner) => (
                  <div key={scanner.deviceId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{scanner.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={scanner.connected ? "default" : "secondary"}>
                          {scanner.connected ? "Connected" : "Disconnected"}
                        </Badge>
                        {scanner.connected && (
                          <Badge variant="outline">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Device ID</p>
                        <p className="font-mono">{formatDeviceId(scanner.deviceId)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Scan Count</p>
                        <p>{scanner.scanCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Error Count</p>
                        <p>{scanner.errorCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Scan</p>
                        <p>{scanner.lastScan ? new Date(scanner.lastScan).toLocaleString() : 'Never'}</p>
                      </div>
                    </div>

                    {scanner.deviceInfo && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <p className="text-muted-foreground">Device Information</p>
                        <p>Product: {scanner.deviceInfo.product}</p>
                        <p>Manufacturer: {scanner.deviceInfo.manufacturer}</p>
                        {scanner.deviceInfo.serialNumber && (
                          <p>Serial: {scanner.deviceInfo.serialNumber}</p>
                        )}
                      </div>
                    )}

                    {scanner.lastError && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
                        <p className="text-red-700">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          Last Error: {scanner.lastError}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scanner Stations</h2>
            <Button onClick={createStation} disabled={!newStation.name || !newStation.location}>
              <Plus className="h-4 w-4 mr-2" />
              Create Station
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* New Station Form */}
            <Card>
              <CardHeader>
                <CardTitle>New Station</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="station-name">Name</Label>
                  <Input
                    id="station-name"
                    value={newStation.name}
                    onChange={(e) => setNewStation({ ...newStation, name: e.target.value })}
                    placeholder="Front Desk Scanner"
                  />
                </div>
                <div>
                  <Label htmlFor="station-location">Location</Label>
                  <Input
                    id="station-location"
                    value={newStation.location}
                    onChange={(e) => setNewStation({ ...newStation, location: e.target.value })}
                    placeholder="Main Library Entrance"
                  />
                </div>
                <div>
                  <Label htmlFor="station-description">Description (Optional)</Label>
                  <Input
                    id="station-description"
                    value={newStation.description}
                    onChange={(e) => setNewStation({ ...newStation, description: e.target.value })}
                    placeholder="Primary check-in/out station"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Existing Stations */}
            <Card>
              <CardHeader>
                <CardTitle>Existing Stations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No stations configured
                  </p>
                ) : (
                  stations.map((station) => (
                    <div
                      key={station.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{station.name}</p>
                          <Badge variant={station.isActive ? "default" : "secondary"}>
                            {station.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{station.location}</p>
                        {station.description && (
                          <p className="text-xs text-muted-foreground">{station.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {station.scannerConfigs.length} scanner(s)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteStation(station.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scan Statistics</h2>
            <Button variant="outline" onClick={resetStatistics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Statistics
            </Button>
          </div>

          {statistics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.totalScans}</div>
                  <p className="text-sm text-muted-foreground">
                    All time scans
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Successful</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{statistics.successfulScans}</div>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((statistics.successfulScans / Math.max(statistics.totalScans, 1)) * 100)}% success rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{statistics.failedScans}</div>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((statistics.failedScans / Math.max(statistics.totalScans, 1)) * 100)}% failure rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Duplicates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{statistics.duplicateScans}</div>
                  <p className="text-sm text-muted-foreground">
                    Prevented duplicates
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Invalid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-600">{statistics.invalidScans}</div>
                  <p className="text-sm text-muted-foreground">
                    Unrecognized barcodes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Avg Processing Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{statistics.averageProcessingTime.toFixed(0)}ms</div>
                  <p className="text-sm text-muted-foreground">
                    Per scan
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Last Scan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {statistics.lastScanTime ? new Date(statistics.lastScanTime).toLocaleString() : 'Never'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Most recent activity
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No statistics available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}