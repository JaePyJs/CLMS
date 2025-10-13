import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  automationApi,
  studentsApi,
  equipmentApi,
  analyticsApi,
} from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

// Health check hook
export const useHealthCheck = () => {
  const setBackendConnection = useAppStore(
    (state) => state.setBackendConnection
  );

  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      try {
        const result = await automationApi.health();
        setBackendConnection(true);
        return result;
      } catch (error) {
        console.log(error);
        setBackendConnection(false);
        // Return a safe fallback instead of throwing
        return { timestamp: new Date().toISOString(), connected: false };
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false, // Don't retry to avoid constant errors
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
};

// Automation hooks
export const useAutomationJobs = () => {
  const setAutomationJobs = useAppStore((state) => state.setAutomationJobs);

  const query = useQuery({
    queryKey: ['automation-jobs'],
    queryFn: async () => {
      const response = await automationApi.getJobs();
      const jobs = (response.data || []) as any[];
      setAutomationJobs(jobs);
      return jobs;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  return query;
};

export const useTriggerJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => automationApi.triggerJob(jobId),
    onSuccess: () => {
      toast.success('Job triggered successfully');
      queryClient.invalidateQueries({ queryKey: ['automation-jobs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to trigger job');
    },
  });
};

export const useGoogleSheetsTest = () => {
  return useQuery({
    queryKey: ['google-sheets-test'],
    queryFn: automationApi.testGoogleSheets,
    refetchInterval: 60000, // Check every minute
  });
};

// Students hooks
export const useStudents = () => {
  const setStudents = useAppStore((state) => state.setStudents);

  const query = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const response = await studentsApi.getStudents();
      const students = (response.data || []) as any[];
      setStudents(students);
      return students;
    },
    enabled: false, // Don't fetch automatically until we have the endpoint
  });

  return query;
};

export const useStudentActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityData: any) => studentsApi.logActivity(activityData),
    onSuccess: () => {
      toast.success('Activity logged successfully');
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to log activity');
    },
  });
};

// Equipment hooks
export const useEquipment = () => {
  const setEquipment = useAppStore((state) => state.setEquipment);

  const query = useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const response = await equipmentApi.getEquipment();
      const equipment = (response.data || []) as any[];
      setEquipment(equipment);
      return equipment;
    },
    enabled: false, // Don't fetch automatically until we have the endpoint
    refetchInterval: 5000, // Refresh every 5 seconds for real-time status
  });

  return query;
};

export const useStartSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ equipmentId, studentId, timeLimitMinutes }: any) =>
      equipmentApi.startSession(equipmentId, studentId, timeLimitMinutes),
    onSuccess: () => {
      toast.success('Session started successfully');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to start session');
    },
  });
};

export const useEndSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => equipmentApi.endSession(sessionId),
    onSuccess: () => {
      toast.success('Session ended successfully');
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to end session');
    },
  });
};

// Analytics hooks
export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      try {
        const response = await analyticsApi.getMetrics();
        return response.data;
      } catch (error) {
        // Return real data structure initialized to 0
        return {
          totalStudents: 0,
          activeSessions: 0,
          pendingTasks: 0,
          equipmentInUse: 0,
          availableComputers: 8,
          availableGamingStations: 4,
          availableAVR: 1,
          todayActivities: 0,
          weeklyActivities: 0,
          monthlyActivities: 0,
          overdueBooks: 0,
          dueSoonBooks: 0,
          returnedBooks: 0,
        };
      }
    },
    enabled: true, // Enable fetching when ready
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });
};

export const useUsageStats = (period: 'day' | 'week' | 'month' = 'day') => {
  return useQuery({
    queryKey: ['usage-stats', period],
    queryFn: async () => {
      const response = await analyticsApi.getUsageStats(period);
      return response.data;
    },
    enabled: false, // Don't fetch automatically until we have the endpoint
  });
};

export const useActivityTimeline = (limit?: number) => {
  const setActivities = useAppStore((state) => state.setActivities);

  return useQuery({
    queryKey: ['activity-timeline', limit],
    queryFn: async () => {
      try {
        const response = await analyticsApi.getTimeline(limit);
        const rawTimeline = response.data as any;
        const activities = Array.isArray(rawTimeline?.timeline)
          ? rawTimeline.timeline
          : Array.isArray(rawTimeline)
          ? rawTimeline
          : [];
        setActivities(activities);
        return activities;
      } catch (error) {
        // Return real data structure initialized to empty array
        const fallbackActivities: any[] = [];
        setActivities(fallbackActivities);
        return fallbackActivities;
      }
    },
    enabled: true, // Enable fetching when ready
    refetchInterval: 15000, // Refresh every 15 seconds
    retry: false,
  });
};

// Notifications hook for calendar integration
export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const response = await analyticsApi.getNotifications();
        return response.data || [];
      } catch (error) {
        // Return real data structure initialized to empty array
        return [];
      }
    },
    enabled: true, // Enable fetching when ready
    refetchInterval: 60000, // Refresh every minute
    retry: false,
  });
};

export const useExportData = () => {
  return useMutation({
    mutationFn: ({
      format,
      dateRange,
    }: {
      format: 'csv' | 'json';
      dateRange?: any;
    }) => analyticsApi.exportData(format, dateRange),
    onSuccess: (response, variables) => {
      toast.success('Data exported successfully');
      // Handle file download if needed
      if (response.data) {
        // Create download link
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: variables.format === 'csv' ? 'text/csv' : 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clms-export.${variables.format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to export data');
    },
  });
};
