import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';
import { configure } from '@testing-library/react';
import * as React from 'react';

// Configure testing library for React 19 compatibility
configure({
  testIdAttribute: 'data-testid',
});

// Mock IntersectionObserver
const IntersectionObserverMock = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Mock ResizeObserver
const ResizeObserverMock = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock document methods for theme provider
Object.defineProperty(document, 'documentElement', {
  value: {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
  writable: true,
});

// Mock querySelector for meta theme-color only
const originalQuerySelector = document.querySelector.bind(document);
Object.defineProperty(document, 'querySelector', {
  value: vi.fn().mockImplementation((selector: string) => {
    // Only mock the meta theme-color selector
    if (selector === 'meta[name="theme-color"]') {
      return {
        setAttribute: vi.fn(),
      };
    }
    // For all other selectors, use the real querySelector
    return originalQuerySelector(selector);
  }),
  writable: true,
});

// React 19 compatibility fixes
// Suppress React 19 warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock Radix UI components for React 19 compatibility
vi.mock('@radix-ui/react-dropdown-menu', () => ({
  Root: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-root', ...props },
      children
    ),
  Trigger: ({ children, asChild, ...props }: any) => {
    if (asChild && children) {
      return children;
    }
    return React.createElement(
      'button',
      { 'data-testid': 'dropdown-menu-trigger', ...props },
      children
    );
  },
  Content: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-content', ...props },
      children
    ),
  Item: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-item', ...props },
      children
    ),
  CheckboxItem: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-checkbox-item', ...props },
      children
    ),
  RadioItem: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-radio-item', ...props },
      children
    ),
  Label: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-label', ...props },
      children
    ),
  Separator: ({ ...props }: any) =>
    React.createElement('div', {
      'data-testid': 'dropdown-menu-separator',
      ...props,
    }),
  ItemIndicator: ({ children, ...props }: any) =>
    React.createElement(
      'span',
      { 'data-testid': 'dropdown-menu-item-indicator', ...props },
      children
    ),
  Group: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-group', ...props },
      children
    ),
  Portal: ({ children }: any) => children,
  Sub: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-sub', ...props },
      children
    ),
  SubTrigger: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-sub-trigger', ...props },
      children
    ),
  SubContent: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-sub-content', ...props },
      children
    ),
  RadioGroup: ({ children, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dropdown-menu-radio-group', ...props },
      children
    ),
}));

vi.mock('@radix-ui/react-context', () => ({
  createContext: (defaultValue: any) => {
    const context = {
      Provider: ({ children, value: _value }: any) => children,
      Consumer: ({ children }: any) => children(defaultValue),
    };
    return context;
  },
  useContext: () => ({}),
}));

// Mock other Radix UI components that might be used
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dialog-root', ...props },
      children
    ),
  Trigger: ({
    children,
    asChild,
    onOpenChange,
    onValueChange,
    ...props
  }: any) => {
    if (asChild && children) {
      return children;
    }
    return React.createElement(
      'button',
      { 'data-testid': 'dialog-trigger', ...props },
      children
    );
  },
  Content: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dialog-content', ...props },
      children
    ),
  Overlay: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'dialog-overlay', ...props },
      children
    ),
  Portal: ({ children }: any) => children,
  Title: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'h2',
      { 'data-testid': 'dialog-title', ...props },
      children
    ),
  Description: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'p',
      { 'data-testid': 'dialog-description', ...props },
      children
    ),
  Close: ({
    children,
    asChild,
    onOpenChange,
    onValueChange,
    ...props
  }: any) => {
    if (asChild && children) {
      return children;
    }
    return React.createElement(
      'button',
      { 'data-testid': 'dialog-close', ...props },
      children
    );
  },
}));

vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'popover-root', ...props },
      children
    ),
  Trigger: ({
    children,
    asChild,
    onOpenChange,
    onValueChange,
    ...props
  }: any) => {
    if (asChild && children) {
      return children;
    }
    return React.createElement(
      'button',
      { 'data-testid': 'popover-trigger', ...props },
      children
    );
  },
  Content: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'popover-content', ...props },
      children
    ),
  Portal: ({ children }: any) => children,
}));

vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: any) => children,
  Root: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'tooltip-root', ...props },
      children
    ),
  Trigger: ({
    children,
    asChild,
    onOpenChange,
    onValueChange,
    ...props
  }: any) => {
    if (asChild && children) {
      return children;
    }
    return React.createElement(
      'div',
      { 'data-testid': 'tooltip-trigger', ...props },
      children
    );
  },
  Content: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'tooltip-content', ...props },
      children
    ),
  Portal: ({ children }: any) => children,
}));

// Mock @radix-ui/react-tabs
vi.mock('@radix-ui/react-tabs', () => ({
  Root: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { ...props, 'data-testid': 'tabs-root' },
      children
    ),
  List: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { ...props, 'data-testid': 'tabs-list' },
      children
    ),
  Trigger: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'button',
      { ...props, 'data-testid': 'tabs-trigger' },
      children
    ),
  Content: ({ children, onOpenChange, onValueChange, ...props }: any) =>
    React.createElement(
      'div',
      { ...props, 'data-testid': 'tabs-content' },
      children
    ),
}));

// Mock @radix-ui/react-direction
vi.mock('@radix-ui/react-direction', () => ({
  useDirection: () => ({ dir: 'ltr' }),
  DirectionProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-direction': 'ltr' }, children),
}));

// Mock window object for React 19 compatibility
Object.defineProperty(window, 'scheduler', {
  value: {
    postTask: vi.fn(),
  },
  writable: true,
});

// Mock window.requestIdleCallback for React 19
Object.defineProperty(window, 'requestIdleCallback', {
  value: vi.fn((callback: (idleDeadline: any) => void) => {
    return setTimeout(() => callback({ timeRemaining: () => 50 }), 0);
  }),
  writable: true,
});

Object.defineProperty(window, 'cancelIdleCallback', {
  value: vi.fn((id: number) => clearTimeout(id)),
  writable: true,
});

// Mock Zustand store
vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    // UI State
    isOnline: true,
    connectedToBackend: false,
    isDarkMode: false,

    // Offline Sync State
    offlineQueueCount: 0,
    lastSyncTime: null,
    syncInProgress: false,

    // Data State
    students: [],
    equipment: [],
    activities: [],
    automationJobs: [],
    notifications: [],

    // Scanning State
    isScanning: false,
    lastScanResult: '',
    scanQueue: [],

    // Actions
    setOnlineStatus: vi.fn(),
    setBackendConnection: vi.fn(),
    setDarkMode: vi.fn(),
    toggleDarkMode: vi.fn(),
    setOfflineQueueCount: vi.fn(),
    setLastSyncTime: vi.fn(),
    setSyncInProgress: vi.fn(),
    setStudents: vi.fn(),
    setEquipment: vi.fn(),
    setActivities: vi.fn(),
    setAutomationJobs: vi.fn(),
    setNotifications: vi.fn(),
    setScanning: vi.fn(),
    setLastScanResult: vi.fn(),
    addToScanQueue: vi.fn(),
    clearScanQueue: vi.fn(),
  })),
}));
