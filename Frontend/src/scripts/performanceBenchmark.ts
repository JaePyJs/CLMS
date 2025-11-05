/**
 * Performance Benchmarking Script
 *
 * Automated performance testing and benchmarking utilities for CLMS frontend
 */

interface BenchmarkConfig {
  name: string;
  iterations: number;
  warmupIterations: number;
  timeout: number;
  thresholds: {
    renderTime: number;
    memoryUsage: number;
    bundleSize: number;
    loadTime: number;
  };
}

interface BenchmarkResult {
  name: string;
  timestamp: number;
  iterations: number;
  results: {
    renderTime: {
      min: number;
      max: number;
      average: number;
      median: number;
      p95: number;
      p99: number;
    };
    memoryUsage: {
      min: number;
      max: number;
      average: number;
      median: number;
      p95: number;
      p99: number;
    };
    bundleSize: number;
    loadTime: {
      min: number;
      max: number;
      average: number;
      median: number;
      p95: number;
      p99: number;
    };
  };
  passed: boolean;
  violations: Array<{
    metric: string;
    threshold: number;
    actual: number;
    severity: 'warning' | 'error';
  }>;
  score: number;
}

class PerformanceBenchmark {
  private static instance: PerformanceBenchmark;
  private results: BenchmarkResult[] = [];
  private isRunning = false;

  private constructor() {}

  public static getInstance(): PerformanceBenchmark {
    if (!PerformanceBenchmark.instance) {
      PerformanceBenchmark.instance = new PerformanceBenchmark();
    }
    return PerformanceBenchmark.instance;
  }

  public async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark is already running');
    }

    this.isRunning = true;
    console.debug(`🚀 Starting benchmark: ${config.name}`);

    const renderTimes: number[] = [];
    const memoryUsages: number[] = [];
    const loadTimes: number[] = [];

    try {
      // Warmup phase
      console.debug(`🔥 Warming up (${config.warmupIterations} iterations)`);
      for (let i = 0; i < config.warmupIterations; i++) {
        await this.measureRender();
        await this.measureMemory();
        await this.measureLoadTime();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Main benchmark phase
      console.debug(`📊 Running benchmark (${config.iterations} iterations)`);
      for (let i = 0; i < config.iterations; i++) {
        const startTime = performance.now();

        // Measure render time
        const renderTime = await this.measureRender();
        renderTimes.push(renderTime);

        // Measure memory usage
        const memoryUsage = await this.measureMemory();
        memoryUsages.push(memoryUsage);

        // Measure load time
        const loadTime = await this.measureLoadTime();
        loadTimes.push(loadTime);

        const iterationTime = performance.now() - startTime;
        console.debug(
          `  Iteration ${i + 1}/${config.iterations}: ${iterationTime.toFixed(2)}ms`
        );

        // Prevent timeout
        if (iterationTime > config.timeout) {
          console.warn(
            `⚠️ Iteration ${i + 1} exceeded timeout of ${config.timeout}ms`
          );
        }

        // Small delay between iterations
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Calculate statistics
      const renderStats = this.calculateStatistics(renderTimes);
      const memoryStats = this.calculateStatistics(memoryUsages);
      const loadStats = this.calculateStatistics(loadTimes);

      // Get bundle size
      const bundleSize = await this.measureBundleSize();

      // Check thresholds
      const violations = this.checkThresholds(config, {
        renderTime: renderStats.average,
        memoryUsage: memoryStats.average,
        bundleSize,
        loadTime: loadStats.average,
      });

      const passed =
        violations.filter((v) => v.severity === 'error').length === 0;
      const score = this.calculateScore(violations);

      const result: BenchmarkResult = {
        name: config.name,
        timestamp: Date.now(),
        iterations: config.iterations,
        results: {
          renderTime: renderStats,
          memoryUsage: memoryStats,
          bundleSize,
          loadTime: loadStats,
        },
        passed,
        violations,
        score,
      };

      this.results.push(result);
      console.debug(
        `✅ Benchmark completed: ${config.name} - Score: ${score.toFixed(1)}/100`
      );

      return result;
    } catch (error) {
      console.error(`❌ Benchmark failed: ${config.name}`, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async measureRender(): Promise<number> {
    const startTime = performance.now();

    // Simulate render measurement
    // In a real app, this would measure actual component render times
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 50 + 10)
    );

    return performance.now() - startTime;
  }

  private async measureMemory(): Promise<number> {
    if (window.performance && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      return memory.usedJSHeapSize;
    }
    return 0;
  }

  private async measureLoadTime(): Promise<number> {
    const startTime = performance.now();

    // Simulate load time measurement
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 20)
    );

    return performance.now() - startTime;
  }

  private async measureBundleSize(): Promise<number> {
    try {
      // Get bundle size from performance entries
      const entries = performance.getEntriesByType('resource');
      const jsEntries = entries.filter((entry) => entry.name.endsWith('.js'));

      return jsEntries.reduce((total, entry) => {
        return total + (entry as any).transferSize || 0;
      }, 0);
    } catch (error) {
      console.warn('Could not measure bundle size:', error);
      return 0;
    }
  }

  private calculateStatistics(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      average,
      median: sorted[Math.floor(sorted.length / 2)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    };
  }

  private checkThresholds(
    config: BenchmarkConfig,
    metrics: {
      renderTime: number;
      memoryUsage: number;
      bundleSize: number;
      loadTime: number;
    }
  ) {
    const violations: Array<{
      metric: string;
      threshold: number;
      actual: number;
      severity: 'warning' | 'error';
    }> = [];

    // Check render time
    if (metrics.renderTime > config.thresholds.renderTime) {
      violations.push({
        metric: 'renderTime',
        threshold: config.thresholds.renderTime,
        actual: metrics.renderTime,
        severity:
          metrics.renderTime > config.thresholds.renderTime * 1.5
            ? 'error'
            : 'warning',
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > config.thresholds.memoryUsage) {
      violations.push({
        metric: 'memoryUsage',
        threshold: config.thresholds.memoryUsage,
        actual: metrics.memoryUsage,
        severity:
          metrics.memoryUsage > config.thresholds.memoryUsage * 1.5
            ? 'error'
            : 'warning',
      });
    }

    // Check bundle size
    if (metrics.bundleSize > config.thresholds.bundleSize) {
      violations.push({
        metric: 'bundleSize',
        threshold: config.thresholds.bundleSize,
        actual: metrics.bundleSize,
        severity:
          metrics.bundleSize > config.thresholds.bundleSize * 1.2
            ? 'error'
            : 'warning',
      });
    }

    // Check load time
    if (metrics.loadTime > config.thresholds.loadTime) {
      violations.push({
        metric: 'loadTime',
        threshold: config.thresholds.loadTime,
        actual: metrics.loadTime,
        severity:
          metrics.loadTime > config.thresholds.loadTime * 2
            ? 'error'
            : 'warning',
      });
    }

    return violations;
  }

  private calculateScore(
    violations: Array<{ severity: 'warning' | 'error' }>
  ): number {
    let score = 100;

    violations.forEach((violation) => {
      if (violation.severity === 'error') {
        score -= 20;
      } else {
        score -= 10;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  public getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  public getLatestResult(): BenchmarkResult | null {
    return this.results.length > 0
      ? (this.results[this.results.length - 1] ?? null)
      : null;
  }

  public compareResults(
    benchmarkName: string,
    limit: number = 10
  ): {
    trend: 'improving' | 'degrading' | 'stable';
    changePercentage: number;
    results: BenchmarkResult[];
  } {
    const relevantResults = this.results
      .filter((result) => result.name === benchmarkName)
      .slice(-limit);

    if (relevantResults.length < 2) {
      return {
        trend: 'stable',
        changePercentage: 0,
        results: relevantResults,
      };
    }

    const latest = relevantResults[relevantResults.length - 1];
    const previous = relevantResults[relevantResults.length - 2];

    if (!latest || !previous) {
      return {
        trend: 'stable' as const,
        changePercentage: 0,
        results: relevantResults,
      };
    }

    const changePercentage =
      ((latest.score - previous.score) / previous.score) * 100;

    let trend: 'improving' | 'degrading' | 'stable';
    if (changePercentage > 5) {
      trend = 'improving';
    } else if (changePercentage < -5) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      changePercentage,
      results: relevantResults,
    };
  }

  public exportResults(): string {
    const exportData = {
      timestamp: Date.now(),
      results: this.results,
      summary: {
        totalBenchmarks: this.results.length,
        averageScore:
          this.results.reduce((sum, r) => sum + r.score, 0) /
          this.results.length,
        passedBenchmarks: this.results.filter((r) => r.passed).length,
        failedBenchmarks: this.results.filter((r) => !r.passed).length,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  public clearResults(): void {
    this.results = [];
  }
}

// Predefined benchmark configurations
export const BENCHMARK_CONFIGS = {
  // Component rendering benchmark
  componentRender: {
    name: 'Component Render Performance',
    iterations: 50,
    warmupIterations: 10,
    timeout: 5000,
    thresholds: {
      renderTime: 16, // 16ms for 60fps
      memoryUsage: 50 * 1024 * 1024, // 50MB
      bundleSize: 1024 * 1024, // 1MB
      loadTime: 3000, // 3 seconds
    },
  },

  // Page load benchmark
  pageLoad: {
    name: 'Page Load Performance',
    iterations: 10,
    warmupIterations: 3,
    timeout: 10000,
    thresholds: {
      renderTime: 100,
      memoryUsage: 100 * 1024 * 1024, // 100MB
      bundleSize: 2 * 1024 * 1024, // 2MB
      loadTime: 5000, // 5 seconds
    },
  },

  // Memory usage benchmark
  memoryUsage: {
    name: 'Memory Usage',
    iterations: 30,
    warmupIterations: 5,
    timeout: 3000,
    thresholds: {
      renderTime: 50,
      memoryUsage: 75 * 1024 * 1024, // 75MB
      bundleSize: 1024 * 1024, // 1MB
      loadTime: 2000, // 2 seconds
    },
  },

  // API performance benchmark
  apiPerformance: {
    name: 'API Performance',
    iterations: 20,
    warmupIterations: 5,
    timeout: 8000,
    thresholds: {
      renderTime: 25,
      memoryUsage: 30 * 1024 * 1024, // 30MB
      bundleSize: 512 * 1024, // 512KB
      loadTime: 1500, // 1.5 seconds
    },
  },
};

// Run all benchmarks
export async function runAllBenchmarks(): Promise<BenchmarkResult[]> {
  const benchmark = PerformanceBenchmark.getInstance();
  const results: BenchmarkResult[] = [];

  console.debug('🚀 Starting comprehensive performance benchmark suite...');

  for (const config of Object.values(BENCHMARK_CONFIGS)) {
    try {
      const result = await benchmark.runBenchmark(config);
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to run benchmark: ${config.name}`, error);
    }
  }

  console.debug('✅ All benchmarks completed');
  return results;
}

// Export singleton instance
export const performanceBenchmark = PerformanceBenchmark.getInstance();
export default performanceBenchmark;
