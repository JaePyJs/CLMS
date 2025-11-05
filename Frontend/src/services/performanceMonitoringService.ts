/**
 * Frontend Performance Monitoring Service
 *
 * Comprehensive performance monitoring and benchmarking service for the CLMS frontend.
 * Tracks Core Web Vitals, component performance, and user interactions.
 */

interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte

  // Navigation metrics
  domContentLoaded: number;
  loadComplete: number;

  // Resource metrics
  resourceCount: number;
  totalResourceSize: number;
  totalTransferSize: number;

  // Runtime metrics
  memoryUsage: number;
  renderTime: number;
  componentRenders: number;

  // User interaction metrics
  interactionTime: number;
  errorCount: number;

  // Custom metrics
  routeChanges: number;
  apiCalls: number;
  apiResponseTime: number;
}

interface PerformanceReport {
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType: string;
  deviceMemory: number;
  hardwareConcurrency: number;
  metrics: PerformanceMetrics;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
  score: number;
}

interface ComponentPerformance {
  name: string;
  renders: number;
  totalTime: number;
  averageTime: number;
  slowestRender: number;
  fastestRender: number;
  lastRender: number;
  mountTime: number;
}

class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private metrics: PerformanceMetrics;
  private componentMetrics: Map<string, ComponentPerformance>;
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private reports: PerformanceReport[] = [];
  private maxReports = 100;

  private constructor() {
    this.metrics = this.getInitialMetrics();
    this.componentMetrics = new Map();
    this.initializeObservers();
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance =
        new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private getInitialMetrics(): PerformanceMetrics {
    return {
      lcp: 0,
      fid: 0,
      cls: 0,
      fcp: 0,
      ttfb: 0,
      domContentLoaded: 0,
      loadComplete: 0,
      resourceCount: 0,
      totalResourceSize: 0,
      totalTransferSize: 0,
      memoryUsage: 0,
      renderTime: 0,
      componentRenders: 0,
      interactionTime: 0,
      errorCount: 0,
      routeChanges: 0,
      apiCalls: 0,
      apiResponseTime: 0,
    };
  }

  private initializeObservers(): void {
    if (!window?.PerformanceObserver) {
      return;
    }

    try {
      // Observer for Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.metrics.lcp = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // Observer for First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-input') {
            this.metrics.fid = (entry as any).processingStart - entry.startTime;
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Observer for Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.metrics.cls = clsValue;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // Observer for First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(
          (entry) => entry.name === 'first-contentful-paint'
        );
        if (fcpEntry) {
          this.metrics.fcp = fcpEntry.startTime;
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(fcpObserver);

      // Observer for navigation timing
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const navEntry = entries[0] as PerformanceNavigationTiming;
        if (navEntry) {
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
          this.metrics.domContentLoaded =
            navEntry.domContentLoadedEventEnd -
            ((navEntry as any).navigationStart || navEntry.startTime);
          this.metrics.loadComplete =
            navEntry.loadEventEnd -
            ((navEntry as any).navigationStart || navEntry.startTime);
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Observer for resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        this.metrics.resourceCount = entries.length;

        entries.forEach((entry) => {
          const resource = entry as PerformanceResourceTiming;
          this.metrics.totalResourceSize +=
            (resource as any).decodedBodySize || 0;
          this.metrics.totalTransferSize += resource.transferSize;
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      console.warn('Failed to initialize performance observers:', error);
    }
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.resetMetrics();

    // Monitor memory usage
    this.startMemoryMonitoring();

    // Monitor route changes
    this.startRouteMonitoring();

    // Monitor API calls
    this.startApiMonitoring();

    // Monitor errors
    this.startErrorMonitoring();

    // Monitor user interactions
    this.startInteractionMonitoring();

    console.log('📊 Performance monitoring started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;

    console.log('📊 Performance monitoring stopped');
  }

  private startMemoryMonitoring(): void {
    if (!window.performance || !(window.performance as any).memory) {
      return;
    }

    const updateMemoryUsage = () => {
      const memory = (window.performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    };

    // Update memory usage every 5 seconds
    const interval = setInterval(updateMemoryUsage, 5000);

    // Clean up on stop
    const originalStopMonitoring = this.stopMonitoring.bind(this);
    this.stopMonitoring = () => {
      clearInterval(interval);
      originalStopMonitoring();
    };
  }

  private startRouteMonitoring(): void {
    // This would integrate with your router to track route changes
    // For now, we'll use the History API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      this.metrics.routeChanges++;
      return originalPushState.apply(history, args);
    };

    history.replaceState = (...args) => {
      this.metrics.routeChanges++;
      return originalReplaceState.apply(history, args);
    };

    window.addEventListener('popstate', () => {
      this.metrics.routeChanges++;
    });
  }

  private startApiMonitoring(): void {
    // Monitor fetch API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      this.metrics.apiCalls++;

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.metrics.apiResponseTime =
          (this.metrics.apiResponseTime + duration) / 2;

        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.metrics.apiResponseTime =
          (this.metrics.apiResponseTime + duration) / 2;
        throw error;
      }
    };
  }

  private startErrorMonitoring(): void {
    window.addEventListener('error', () => {
      this.metrics.errorCount++;
    });

    window.addEventListener('unhandledrejection', () => {
      this.metrics.errorCount++;
    });
  }

  private startInteractionMonitoring(): void {
    let lastInteractionTime = 0;
    const interactionThreshold = 50; // ms

    const measureInteraction = () => {
      const now = performance.now();
      const interactionTime = now - lastInteractionTime;

      if (interactionTime < interactionThreshold) {
        this.metrics.interactionTime =
          (this.metrics.interactionTime + interactionTime) / 2;
      }

      lastInteractionTime = now;
    };

    ['click', 'keydown', 'touchstart'].forEach((eventType) => {
      document.addEventListener(eventType, measureInteraction, {
        passive: true,
      });
    });
  }

  public recordComponentRender(
    componentName: string,
    renderTime: number
  ): void {
    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, {
        name: componentName,
        renders: 0,
        totalTime: 0,
        averageTime: 0,
        slowestRender: 0,
        fastestRender: Infinity,
        lastRender: 0,
        mountTime: 0,
      });
    }

    const metrics = this.componentMetrics.get(componentName)!;
    metrics.renders++;
    metrics.totalTime += renderTime;
    metrics.averageTime = metrics.totalTime / metrics.renders;
    metrics.slowestRender = Math.max(metrics.slowestRender, renderTime);
    metrics.fastestRender = Math.min(metrics.fastestRender, renderTime);
    metrics.lastRender = renderTime;

    this.metrics.componentRenders++;
    this.metrics.renderTime = (this.metrics.renderTime + renderTime) / 2;
  }

  public recordComponentMount(componentName: string, mountTime: number): void {
    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, {
        name: componentName,
        renders: 0,
        totalTime: 0,
        averageTime: 0,
        slowestRender: 0,
        fastestRender: Infinity,
        lastRender: 0,
        mountTime: 0,
      });
    }

    const metrics = this.componentMetrics.get(componentName)!;
    metrics.mountTime = mountTime;
  }

  public resetMetrics(): void {
    this.metrics = this.getInitialMetrics();
    this.componentMetrics.clear();
  }

  public generateReport(): PerformanceReport {
    const now = Date.now();

    const report: PerformanceReport = {
      timestamp: now,
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType || 'unknown',
      deviceMemory: (navigator as any).deviceMemory || 0,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      metrics: { ...this.metrics },
      grade: this.calculateGrade(),
      recommendations: this.generateRecommendations(),
      score: this.calculateScore(),
    };

    // Store report
    this.reports.push(report);
    if (this.reports.length > this.maxReports) {
      this.reports.shift();
    }

    return report;
  }

  private calculateGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.calculateScore();

    if (score >= 90) {
      return 'A';
    }
    if (score >= 80) {
      return 'B';
    }
    if (score >= 70) {
      return 'C';
    }
    if (score >= 60) {
      return 'D';
    }
    return 'F';
  }

  private calculateScore(): number {
    let score = 100;

    // LCP scoring (0-100ms = 100, 1000ms+ = 0)
    if (this.metrics.lcp > 1000) {
      score -= 25;
    } else if (this.metrics.lcp > 500) {
      score -= 15;
    } else if (this.metrics.lcp > 250) {
      score -= 8;
    }

    // FID scoring (0-100ms = 100, 300ms+ = 0)
    if (this.metrics.fid > 300) {
      score -= 20;
    } else if (this.metrics.fid > 200) {
      score -= 12;
    } else if (this.metrics.fid > 100) {
      score -= 6;
    }

    // CLS scoring (0-0.1 = 100, 0.25+ = 0)
    if (this.metrics.cls > 0.25) {
      score -= 25;
    } else if (this.metrics.cls > 0.1) {
      score -= 15;
    } else if (this.metrics.cls > 0.05) {
      score -= 8;
    }

    // Memory usage scoring
    if (this.metrics.memoryUsage > 100) {
      score -= 15;
    } else if (this.metrics.memoryUsage > 50) {
      score -= 8;
    } else if (this.metrics.memoryUsage > 30) {
      score -= 4;
    }

    // Error count scoring
    if (this.metrics.errorCount > 5) {
      score -= 15;
    } else if (this.metrics.errorCount > 2) {
      score -= 8;
    } else if (this.metrics.errorCount > 0) {
      score -= 4;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.lcp > 2500) {
      recommendations.push(
        'Largest Contentful Paint is slow. Optimize images and reduce server response time.'
      );
    }

    if (this.metrics.fid > 300) {
      recommendations.push(
        'First Input Delay is high. Reduce JavaScript execution time and break up long tasks.'
      );
    }

    if (this.metrics.cls > 0.1) {
      recommendations.push(
        'Cumulative Layout Shift is high. Ensure images have dimensions and avoid inserting content above existing content.'
      );
    }

    if (this.metrics.memoryUsage > 50) {
      recommendations.push(
        'Memory usage is high. Consider implementing component unloading and memory cleanup.'
      );
    }

    if (this.metrics.componentRenders > 100) {
      recommendations.push(
        'High number of component renders. Consider using React.memo and useMemo/useCallback.'
      );
    }

    if (this.metrics.apiResponseTime > 1000) {
      recommendations.push(
        'API response time is slow. Consider implementing caching and optimizing backend queries.'
      );
    }

    if (this.metrics.errorCount > 0) {
      recommendations.push(
        'Errors detected. Implement proper error boundaries and improve error handling.'
      );
    }

    if (this.metrics.resourceCount > 100) {
      recommendations.push(
        'High number of resources. Consider bundling and reducing HTTP requests.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Performance is excellent! Continue monitoring for regressions.'
      );
    }

    return recommendations;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getComponentMetrics(): ComponentPerformance[] {
    return Array.from(this.componentMetrics.values());
  }

  public getReports(): PerformanceReport[] {
    return [...this.reports];
  }

  public getLatestReport(): PerformanceReport | null {
    return this.reports.length > 0
      ? (this.reports[this.reports.length - 1] ?? null)
      : null;
  }

  public exportData(): string {
    const exportData = {
      timestamp: Date.now(),
      currentMetrics: this.metrics,
      componentMetrics: Array.from(this.componentMetrics.entries()),
      reports: this.reports,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    return JSON.stringify(exportData, null, 2);
  }

  public async runLighthouseAudit(): Promise<any> {
    if (!(window as any).lighthouse) {
      throw new Error('Lighthouse is not available');
    }

    try {
      const result = await (window as any).lighthouse(window.location.href, {
        only: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: 8080,
      });

      return result;
    } catch (error) {
      console.error('Lighthouse audit failed:', error);
      throw error;
    }
  }

  public getPerformanceInsights(): {
    trends: Array<{
      timestamp: number;
      score: number;
      lcp: number;
      fid: number;
      cls: number;
    }>;
    summary: {
      averageScore: number;
      averageLcp: number;
      averageFid: number;
      averageCls: number;
      improvementAreas: string[];
      strongAreas: string[];
    };
  } {
    const recentReports = this.reports.slice(-10); // Last 10 reports

    if (recentReports.length === 0) {
      return {
        trends: [],
        summary: {
          averageScore: 0,
          averageLcp: 0,
          averageFid: 0,
          averageCls: 0,
          improvementAreas: [],
          strongAreas: [],
        },
      };
    }

    const trends = recentReports.map((report) => ({
      timestamp: report.timestamp,
      score: report.score,
      lcp: report.metrics.lcp,
      fid: report.metrics.fid,
      cls: report.metrics.cls,
    }));

    const averageScore =
      recentReports.reduce((sum, r) => sum + r.score, 0) / recentReports.length;
    const averageLcp =
      recentReports.reduce((sum, r) => sum + r.metrics.lcp, 0) /
      recentReports.length;
    const averageFid =
      recentReports.reduce((sum, r) => sum + r.metrics.fid, 0) /
      recentReports.length;
    const averageCls =
      recentReports.reduce((sum, r) => sum + r.metrics.cls, 0) /
      recentReports.length;

    const latestReport = recentReports[recentReports.length - 1];
    const recommendations = latestReport?.recommendations || [];

    return {
      trends,
      summary: {
        averageScore,
        averageLcp,
        averageFid,
        averageCls,
        improvementAreas: recommendations.slice(0, 3),
        strongAreas: latestReport
          ? this.identifyStrongAreas(latestReport.metrics)
          : [],
      },
    };
  }

  private identifyStrongAreas(metrics: PerformanceMetrics): string[] {
    const strongAreas: string[] = [];

    if (metrics.lcp < 2500) {
      strongAreas.push('Fast Largest Contentful Paint');
    }
    if (metrics.fid < 100) {
      strongAreas.push('Quick First Input Delay');
    }
    if (metrics.cls < 0.1) {
      strongAreas.push('Low Layout Shift');
    }
    if (metrics.memoryUsage < 30) {
      strongAreas.push('Efficient Memory Usage');
    }
    if (metrics.errorCount === 0) {
      strongAreas.push('Error-Free Operation');
    }
    if (metrics.apiResponseTime < 500) {
      strongAreas.push('Fast API Responses');
    }

    return strongAreas.length > 0
      ? strongAreas
      : ['Performance monitoring active'];
  }
}

// Export singleton instance
export const performanceMonitoringService =
  PerformanceMonitoringService.getInstance();
export default performanceMonitoringService;

// Export types
export type { PerformanceMetrics, PerformanceReport, ComponentPerformance };
