import {
  useMediaQuery,
  useWindowSize,
  useIsomorphicLayoutEffect,
} from 'usehooks-ts';
import { useState, useCallback, useEffect } from 'react';

export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  large: number;
}

export interface MobileOptimizationState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
  isExtraLarge: boolean;
  width: number;
  height: number;
  breakpoints: BreakpointConfig;
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
}

export const defaultBreakpoints: BreakpointConfig = {
  mobile: 640, // sm breakpoint
  tablet: 768, // md breakpoint
  desktop: 1024, // lg breakpoint
  large: 1280, // xl breakpoint
};

export const useMobileOptimization = (
  customBreakpoints?: Partial<BreakpointConfig>
): MobileOptimizationState => {
  const breakpoints = { ...defaultBreakpoints, ...customBreakpoints };

  // First, get window size
  const { width: windowWidth, height: windowHeight } = useWindowSize();

  // Then use window dimensions for other calculations
  const width = windowWidth || 1200;
  const height = windowHeight || 800;
  const pixelRatio =
    typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const isLandscape = width > height;

  // Then use media queries (React Hooks)
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.mobile - 1}px)`);
  const isTablet = useMediaQuery(
    `(min-width: ${breakpoints.mobile}px) and (max-width: ${breakpoints.tablet - 1}px)`
  );
  const isDesktop = useMediaQuery(
    `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px)`
  );
  const isLarge = useMediaQuery(
    `(min-width: ${breakpoints.desktop}px) and (max-width: ${breakpoints.large - 1}px)`
  );
  const isExtraLarge = useMediaQuery(`(min-width: ${breakpoints.large}px)`);

  return {
    isMobile,
    isTablet,
    isDesktop: isDesktop && !isLarge && !isExtraLarge,
    isLarge: isLarge && !isExtraLarge,
    isExtraLarge,
    width: windowWidth || width,
    height: windowHeight || height,
    breakpoints,
    orientation: isLandscape ? 'landscape' : 'portrait',
    pixelRatio,
  };
};

export interface TouchOptimizationConfig {
  minTouchTargetSize: number;
  gestureSensitivity: number;
  scrollThreshold: number;
  doubleTapTimeout: number;
}

export const defaultTouchConfig: TouchOptimizationConfig = {
  minTouchTargetSize: 44, // Apple HIG minimum
  gestureSensitivity: 0.4,
  scrollThreshold: 10,
  doubleTapTimeout: 300,
};

export const useTouchOptimization = (
  config: Partial<TouchOptimizationConfig> = {}
) => {
  const touchConfig = { ...defaultTouchConfig, ...config };
  const [touchStart, setTouchStart] = useState<{
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) {
      return;
    }
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    });
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) {
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        return;
      }
      const deltaX = Math.abs(touch.clientX - touchStart.x);
      const deltaY = Math.abs(touch.clientY - touchStart.y);
      const deltaTime = Date.now() - touchStart.time;

      // Detect gestures
      if (deltaTime < touchConfig.doubleTapTimeout) {
        // Double tap detection
        if (
          deltaX < touchConfig.scrollThreshold &&
          deltaY < touchConfig.scrollThreshold
        ) {
          return 'double-tap';
        }
      }

      // Swipe detection
      if (deltaX > deltaY && deltaX > touchConfig.scrollThreshold) {
        return touch.clientX < touchStart.x ? 'swipe-left' : 'swipe-right';
      }

      if (deltaY > deltaX && deltaY > touchConfig.scrollThreshold) {
        return touch.clientY < touchStart.y ? 'swipe-up' : 'swipe-down';
      }

      clearTouchStart();
      return undefined;
    },
    [touchStart, touchConfig]
  );

  const clearTouchStart = useCallback(() => {
    setTouchStart(null);
  }, []);

  return {
    handleTouchStart,
    handleTouchEnd,
    clearTouchStart,
    touchConfig,
  };
};

export interface AccessibilityConfig {
  enableReducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  screenReaderAnnouncement: boolean;
}

export const useAccessibility = (): AccessibilityConfig => {
  const [preferences, setPreferences] = useState<AccessibilityConfig>({
    enableReducedMotion: false,
    fontSize: 'medium',
    highContrast: false,
    screenReaderAnnouncement: false,
  });

  useIsomorphicLayoutEffect(() => {
    // Detect user preferences
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const prefersHighContrast = window.matchMedia(
      '(prefers-contrast: high)'
    ).matches;

    setPreferences((prev) => ({
      ...prev,
      enableReducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
    }));
  }, []);

  return preferences;
};

// Utility functions for responsive design
export const getResponsiveClasses = (
  baseClasses: string,
  state: MobileOptimizationState
) => {
  if (!baseClasses.trim()) {
    return '';
  }

  // For mobile-first approach, base classes apply to mobile by default
  let responsiveClasses = baseClasses;

  // Add tablet-specific classes (md:)
  if (state.isTablet) {
    const tabletClasses = baseClasses
      .split(' ')
      .map((cls) => `md:${cls}`)
      .join(' ');
    responsiveClasses += ` ${tabletClasses}`;
  }

  // Add desktop-specific classes (lg:)
  if (state.isDesktop) {
    const desktopClasses = baseClasses
      .split(' ')
      .map((cls) => `lg:${cls}`)
      .join(' ');
    responsiveClasses += ` ${desktopClasses}`;
  }

  // Add large desktop-specific classes (xl:)
  if (state.isLarge) {
    const largeClasses = baseClasses
      .split(' ')
      .map((cls) => `xl:${cls}`)
      .join(' ');
    responsiveClasses += ` ${largeClasses}`;
  }

  // Add extra large classes (2xl:)
  if (state.isExtraLarge) {
    const xlargeClasses = baseClasses
      .split(' ')
      .map((cls) => `2xl:${cls}`)
      .join(' ');
    responsiveClasses += ` ${xlargeClasses}`;
  }

  return responsiveClasses.trim();
};

export const getOptimalImageSize = (
  state: MobileOptimizationState,
  baseWidth: number,
  baseHeight: number
) => {
  const scale = state.isMobile ? 0.7 : state.isTablet ? 0.85 : 1;
  return {
    width: Math.floor(baseWidth * scale),
    height: Math.floor(baseHeight * scale),
  };
};

// Custom hook for optimized scroll behavior
export const useVirtualScrolling = (
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  useEffect(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = start + visibleCount + 1; // +1 for buffer

    setVisibleRange({ start, end });
  }, [scrollTop, itemHeight, containerHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange,
    handleScroll,
    getVisibleItems: <T>(items: T[]) =>
      items.slice(visibleRange.start, visibleRange.end),
  };
};

// Performance optimization hook
export const usePerformanceOptimization = () => {
  const { isMobile, isTablet, isDesktop, isLarge } = useMobileOptimization();

  // Determine performance tier
  const getPerformanceTier = () => {
    if (isMobile) {
      return 'mobile';
    }
    if (isTablet) {
      return 'tablet';
    }
    if (isDesktop) {
      return 'desktop';
    }
    if (isLarge) {
      return 'large';
    }
    return 'extra-large';
  };

  const tier = getPerformanceTier();

  return {
    tier,

    // Debounce timing based on device capability
    debounceMs: tier === 'mobile' ? 300 : tier === 'tablet' ? 200 : 100,

    // Animation settings
    enableAnimations: tier !== 'mobile',
    reducedMotion: tier === 'mobile',

    // Request limits
    maxConcurrentRequests:
      tier === 'mobile'
        ? 2
        : tier === 'tablet'
          ? 4
          : tier === 'desktop'
            ? 6
            : 8,

    // Image optimization
    lazyLoadingEnabled: tier === 'mobile' || tier === 'tablet',
    imageQuality: tier === 'mobile' ? 70 : tier === 'tablet' ? 80 : 90,

    // Data management
    dataReductionMode: tier === 'mobile',
    itemsPerPage:
      tier === 'mobile'
        ? 10
        : tier === 'tablet'
          ? 25
          : tier === 'desktop'
            ? 50
            : 100,

    // Virtual scrolling
    enableVirtualScrolling: tier === 'mobile' || tier === 'tablet',

    // Cache settings
    cacheSize: tier === 'mobile' ? 50 : tier === 'tablet' ? 100 : 200,
  };
};
