import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Storage keys
const ACTIVE_STUDENT_KEY = 'clms-active-student';
const ACTIVE_STUDENT_EXPIRY_KEY = 'clms-active-student-expiry';

// Types for our application state
export interface Student {
  id: string;
  name: string;
  gradeLevel: string;
  gradeCategory: 'primary' | 'gradeSchool' | 'juniorHigh' | 'seniorHigh';
  barcode?: string;
}

export interface Equipment {
  id: string;
  type: 'computer' | 'gaming' | 'avr';
  name: string;
  status: 'available' | 'in-use' | 'maintenance' | 'offline';
  currentSession?: EquipmentSession;
}

export interface EquipmentSession {
  id: string;
  studentId: string;
  studentName?: string;
  gradeLevel?: string;
  startTime: Date;
  endTime?: Date;
  timeLimitMinutes: number;
  remainingMinutes?: number;
  status: 'active' | 'completed' | 'expired';
}

export interface Activity {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  gradeCategory: string;
  activityType:
    | 'borrowing'
    | 'returning'
    | 'computer'
    | 'gaming'
    | 'avr'
    | 'recreation'
    | 'study'
    | 'general';
  equipmentId?: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  timeLimitMinutes?: number;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
}

export interface AutomationJob {
  id: string;
  name: string;
  type: 'backup' | 'notification' | 'sync' | 'cleanup';
  status: 'running' | 'completed' | 'failed' | 'queued';
  lastRun?: Date;
  nextRun?: Date;
  duration?: number;
  errorMessage?: string;
  progress?: number;
}

export interface ScanQueueItem {
  id: string;
  barcode: string;
  type: 'student' | 'book' | 'equipment';
  timestamp: number;
  processed: boolean;
}

export interface AppNotification {
  id: string;
  userId?: string;
  type:
    | 'OVERDUE_BOOK'
    | 'FINE_ADDED'
    | 'FINE_WAIVED'
    | 'BOOK_DUE_SOON'
    | 'EQUIPMENT_EXPIRING'
    | 'SYSTEM_ALERT'
    | 'INFO'
    | 'WARNING'
    | 'ERROR'
    | 'SUCCESS';
  title: string;
  message: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  read: boolean;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
}

// Helper to get stored active student
const getStoredActiveStudent = (): {
  student: Student | null;
  expiry: number | null;
} => {
  try {
    const studentStr = localStorage.getItem(ACTIVE_STUDENT_KEY);
    const expiryStr = localStorage.getItem(ACTIVE_STUDENT_EXPIRY_KEY);

    if (!studentStr || !expiryStr) {
      return { student: null, expiry: null };
    }

    const expiry = parseInt(expiryStr, 10);

    // Check if expired
    if (Date.now() > expiry) {
      localStorage.removeItem(ACTIVE_STUDENT_KEY);
      localStorage.removeItem(ACTIVE_STUDENT_EXPIRY_KEY);
      return { student: null, expiry: null };
    }

    return { student: JSON.parse(studentStr), expiry };
  } catch {
    return { student: null, expiry: null };
  }
};

// Helper to store active student
const storeActiveStudent = (student: Student | null, expiry: number | null) => {
  try {
    if (student && expiry) {
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(student));
      localStorage.setItem(ACTIVE_STUDENT_EXPIRY_KEY, String(expiry));
    } else {
      localStorage.removeItem(ACTIVE_STUDENT_KEY);
      localStorage.removeItem(ACTIVE_STUDENT_EXPIRY_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

// App store interface
interface AppStore {
  // UI State
  isOnline: boolean;
  connectedToBackend: boolean;
  isDarkMode: boolean;

  // Offline Sync State
  offlineQueueCount: number;
  lastSyncTime: number | null;
  syncInProgress: boolean;

  // Data State
  students: Student[];
  equipment: Equipment[];
  activities: Activity[];
  automationJobs: AutomationJob[];
  notifications: AppNotification[];

  // Scanning State
  isScanning: boolean;
  lastScanResult: string;
  scanQueue: ScanQueueItem[];

  // Active Student State
  activeStudent: Student | null;
  activeStudentExpiry: number | null;
  recentScannedStudents: Student[];

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  setBackendConnection: (connected: boolean) => void;
  setDarkMode: (isDark: boolean) => void;
  toggleDarkMode: () => void;
  setOfflineQueueCount: (count: number) => void;
  setLastSyncTime: (time: number | null) => void;
  setSyncInProgress: (inProgress: boolean) => void;
  setStudents: (students: Student[]) => void;
  setEquipment: (equipment: Equipment[]) => void;
  setActivities: (activities: Activity[]) => void;
  setAutomationJobs: (jobs: AutomationJob[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setScanning: (scanning: boolean) => void;
  setLastScanResult: (result: string) => void;
  addToScanQueue: (item: ScanQueueItem) => void;
  clearScanQueue: () => void;
  setActiveStudent: (student: Student | null, durationMs?: number) => void;
  clearActiveStudent: () => void;
  initializeActiveStudent: () => void;
}

// Get initial active student from storage
const storedData = getStoredActiveStudent();

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // Initial state - restore active student from localStorage
      isOnline: navigator.onLine,
      connectedToBackend: false,
      isDarkMode: false,
      offlineQueueCount: 0,
      lastSyncTime: null,
      syncInProgress: false,
      students: [],
      equipment: [],
      activities: [],
      automationJobs: [],
      notifications: [],
      isScanning: false,
      lastScanResult: '',
      scanQueue: [],
      activeStudent: storedData.student,
      activeStudentExpiry: storedData.expiry,
      recentScannedStudents: [],

      // Actions
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setBackendConnection: (connected) =>
        set({ connectedToBackend: connected }),
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setOfflineQueueCount: (count) => set({ offlineQueueCount: count }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
      setSyncInProgress: (inProgress) => set({ syncInProgress: inProgress }),
      setStudents: (students) => set({ students }),
      setEquipment: (equipment) => set({ equipment }),
      setActivities: (activities) => set({ activities }),
      setAutomationJobs: (automationJobs) => set({ automationJobs }),
      setNotifications: (notifications) => set({ notifications }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      setLastScanResult: (result) => set({ lastScanResult: result }),
      addToScanQueue: (item) =>
        set((state) => ({
          scanQueue: [...state.scanQueue, item],
        })),
      clearScanQueue: () => set({ scanQueue: [] }),
      setActiveStudent: (student, durationMs = 15 * 60 * 1000) => {
        if (student) {
          const expiry = Date.now() + durationMs;

          // Persist to localStorage
          storeActiveStudent(student, expiry);

          set((state) => ({
            activeStudent: student,
            activeStudentExpiry: expiry,
            recentScannedStudents: [
              student,
              ...state.recentScannedStudents.filter((s) => s.id !== student.id),
            ].slice(0, 5),
          }));

          // Auto-clear after duration
          setTimeout(() => {
            set((state) => {
              if (
                state.activeStudent?.id === student.id &&
                state.activeStudentExpiry === expiry
              ) {
                // Clear from localStorage too
                storeActiveStudent(null, null);
                return { activeStudent: null, activeStudentExpiry: null };
              }
              return {};
            });
          }, durationMs);
        } else {
          storeActiveStudent(null, null);
          set({ activeStudent: null, activeStudentExpiry: null });
        }
      },
      clearActiveStudent: () => {
        storeActiveStudent(null, null);
        set({ activeStudent: null, activeStudentExpiry: null });
      },

      // Initialize active student from storage (call on app mount to set up auto-clear timer)
      initializeActiveStudent: () => {
        set((state) => {
          if (state.activeStudent && state.activeStudentExpiry) {
            const remainingTime = state.activeStudentExpiry - Date.now();
            if (remainingTime > 0) {
              // Set up auto-clear timer for remaining time
              const student = state.activeStudent;
              const expiry = state.activeStudentExpiry;
              setTimeout(() => {
                set((s) => {
                  if (
                    s.activeStudent?.id === student.id &&
                    s.activeStudentExpiry === expiry
                  ) {
                    storeActiveStudent(null, null);
                    return { activeStudent: null, activeStudentExpiry: null };
                  }
                  return {};
                });
              }, remainingTime);
            } else {
              // Already expired, clear it
              storeActiveStudent(null, null);
              return { activeStudent: null, activeStudentExpiry: null };
            }
          }
          return {};
        });
      },
    }),
    {
      name: 'clms-store',
    }
  )
);

// Auto-initialize on store creation
useAppStore.getState().initializeActiveStudent();
