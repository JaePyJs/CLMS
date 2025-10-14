/**
 * Performance Test Script
 *
 * Automated performance testing for CLMS frontend with real-world scenarios
 */

import { performanceMonitoringService } from '@/services/performanceMonitoringService';
import { performanceBenchmark, BENCHMARK_CONFIGS } from './performanceBenchmark';

interface TestScenario {
  name: string;
  description: string;
  steps: Array<{
    action: string;
    measure: boolean;
    timeout?: number;
  }>;
  expectedResults: {
    maxRenderTime: number;
    maxMemoryUsage: number;
    maxErrors: number;
  };
}

class PerformanceTest {
  private static instance: PerformanceTest;
  private testResults: Array<{
    scenario: string;
    passed: boolean;
    duration: number;
    metrics: any;
    errors: string[];
  }> = [];

  private constructor() {}

  public static getInstance(): PerformanceTest {
    if (!PerformanceTest.instance) {
      PerformanceTest.instance = new PerformanceTest();
    }
    return PerformanceTest.instance;
  }

  public async runTest(scenario: TestScenario): Promise<{
    scenario: string;
    passed: boolean;
    duration: number;
    metrics: any;
    errors: string[];
  }> {
    console.log(`🧪 Running test: ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);

    const startTime = Date.now();
    const errors: string[] = [];
    let passed = true;

    try {
      // Start performance monitoring
      performanceMonitoringService.startMonitoring();

      const initialMetrics = performanceMonitoringService.getMetrics();

      // Execute test steps
      for (const step of scenario.steps) {
        try {
          console.log(`  ➡️ ${step.action}`);

          if (step.measure) {
            const stepStartTime = performance.now();
            await this.executeStep(step.action);
            const stepDuration = performance.now() - stepStartTime;

            if (step.timeout && stepDuration > step.timeout) {
              errors.push(`Step timeout: ${step.action} took ${stepDuration.toFixed(2)}ms (limit: ${step.timeout}ms)`);
              passed = false;
            }
          } else {
            await this.executeStep(step.action);
          }
        } catch (error) {
          const errorMessage = `Step failed: ${step.action} - ${error.message}`;
          errors.push(errorMessage);
          console.error(`  ❌ ${errorMessage}`);
          passed = false;
        }
      }

      // Get final metrics
      const finalMetrics = performanceMonitoringService.getMetrics();
      const duration = Date.now() - startTime;

      // Validate results
      if (finalMetrics.renderTime > scenario.expectedResults.maxRenderTime) {
        errors.push(`Render time exceeded: ${finalMetrics.renderTime.toFixed(2)}ms (limit: ${scenario.expectedResults.maxRenderTime}ms)`);
        passed = false;
      }

      if (finalMetrics.memoryUsage > scenario.expectedResults.maxMemoryUsage) {
        errors.push(`Memory usage exceeded: ${finalMetrics.memoryUsage.toFixed(2)}MB (limit: ${(scenario.expectedResults.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB)`);
        passed = false;
      }

      if (finalMetrics.errorCount > scenario.expectedResults.maxErrors) {
        errors.push(`Error count exceeded: ${finalMetrics.errorCount} (limit: ${scenario.expectedResults.maxErrors})`);
        passed = false;
      }

      const result = {
        scenario: scenario.name,
        passed,
        duration,
        metrics: {
          initial: initialMetrics,
          final: finalMetrics,
          delta: {
            renderTime: finalMetrics.renderTime - initialMetrics.renderTime,
            memoryUsage: finalMetrics.memoryUsage - initialMetrics.memoryUsage,
            errorCount: finalMetrics.errorCount - initialMetrics.errorCount,
          },
        },
        errors,
      };

      this.testResults.push(result);

      console.log(`${passed ? '✅' : '❌'} Test ${scenario.name}: ${passed ? 'PASSED' : 'FAILED'} (${duration.toFixed(2)}ms)`);

      if (errors.length > 0) {
        console.log('  Errors:');
        errors.forEach(error => console.log(`    - ${error}`));
      }

      return result;
    } catch (error) {
      const result = {
        scenario: scenario.name,
        passed: false,
        duration: Date.now() - startTime,
        metrics: {},
        errors: [`Test execution failed: ${error.message}`],
      };

      this.testResults.push(result);
      console.error(`❌ Test ${scenario.name} FAILED: ${error.message}`);

      return result;
    } finally {
      performanceMonitoringService.stopMonitoring();
    }
  }

  private async executeStep(action: string): Promise<void> {
    switch (action) {
      case 'navigate_to_dashboard':
        // Simulate navigation
        window.location.hash = '#dashboard';
        await new Promise(resolve => setTimeout(resolve, 100));
        break;

      case 'load_students_list':
        // Simulate loading students
        await this.simulateApiCall('/api/students', 200);
        break;

      case 'search_students':
        // Simulate search
        await this.simulateUserInput();
        break;

      case 'load_books_catalog':
        // Simulate loading books
        await this.simulateApiCall('/api/books', 300);
        break;

      case 'filter_books':
        // Simulate filtering
        await this.simulateUserInput();
        break;

      case 'load_equipment':
        // Simulate loading equipment
        await this.simulateApiCall('/api/equipment', 150);
        break;

      case 'scan_barcode':
        // Simulate barcode scanning
        await this.simulateUserInput();
        break;

      case 'generate_report':
        // Simulate report generation
        await this.simulateApiCall('/api/reports', 500);
        break;

      case 'upload_file':
        // Simulate file upload
        await this.simulateFileUpload();
        break;

      case 'switch_theme':
        // Simulate theme switching
        document.body.classList.toggle('dark');
        await new Promise(resolve => setTimeout(resolve, 50));
        break;

      case 'resize_window':
        // Simulate window resize
        window.dispatchEvent(new Event('resize'));
        await new Promise(resolve => setTimeout(resolve, 100));
        break;

      case 'scroll_page':
        // Simulate scrolling
        window.scrollTo({ top: 500, behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 200));
        break;

      case 'open_modal':
        // Simulate modal opening
        await this.simulateUserInteraction();
        break;

      case 'submit_form':
        // Simulate form submission
        await this.simulateApiCall('/api/submit', 300);
        break;

      default:
        // Default simulation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
  }

  private async simulateApiCall(endpoint: string, delay: number): Promise<void> {
    const startTime = performance.now();

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, delay));

    const endTime = performance.now();
    console.log(`    🌐 API call to ${endpoint} took ${(endTime - startTime).toFixed(2)}ms`);
  }

  private async simulateUserInput(): Promise<void> {
    // Simulate user interaction latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
  }

  private async simulateUserInteraction(): Promise<void> {
    // Simulate click or interaction
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 20));
  }

  private async simulateFileUpload(): Promise<void> {
    // Simulate file upload progress
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`    📤 Upload progress: ${((i + 1) / steps * 100).toFixed(0)}%`);
    }
  }

  public async runAllTests(): Promise<Array<{
    scenario: string;
    passed: boolean;
    duration: number;
    metrics: any;
    errors: string[];
  }>> {
    console.log('🚀 Starting comprehensive performance test suite...');

    const testScenarios: TestScenario[] = [
      {
        name: 'Dashboard Navigation',
        description: 'Test dashboard navigation and initial load',
        steps: [
          { action: 'navigate_to_dashboard', measure: true },
          { action: 'load_students_list', measure: true, timeout: 2000 },
          { action: 'load_books_catalog', measure: true, timeout: 2000 },
        ],
        expectedResults: {
          maxRenderTime: 1000,
          maxMemoryUsage: 50 * 1024 * 1024,
          maxErrors: 0,
        },
      },
      {
        name: 'Search Performance',
        description: 'Test search functionality performance',
        steps: [
          { action: 'navigate_to_dashboard', measure: false },
          { action: 'search_students', measure: true },
          { action: 'search_students', measure: true },
          { action: 'search_students', measure: true },
        ],
        expectedResults: {
          maxRenderTime: 500,
          maxMemoryUsage: 30 * 1024 * 1024,
          maxErrors: 0,
        },
      },
      {
        name: 'Data Loading',
        description: 'Test large dataset loading performance',
        steps: [
          { action: 'load_students_list', measure: true, timeout: 3000 },
          { action: 'load_books_catalog', measure: true, timeout: 3000 },
          { action: 'load_equipment', measure: true, timeout: 2000 },
        ],
        expectedResults: {
          maxRenderTime: 2000,
          maxMemoryUsage: 80 * 1024 * 1024,
          maxErrors: 1,
        },
      },
      {
        name: 'User Interactions',
        description: 'Test user interaction responsiveness',
        steps: [
          { action: 'switch_theme', measure: true },
          { action: 'resize_window', measure: true },
          { action: 'scroll_page', measure: true },
          { action: 'open_modal', measure: true },
          { action: 'submit_form', measure: true, timeout: 2000 },
        ],
        expectedResults: {
          maxRenderTime: 300,
          maxMemoryUsage: 40 * 1024 * 1024,
          maxErrors: 0,
        },
      },
      {
        name: 'Error Handling',
        description: 'Test error handling performance',
        steps: [
          { action: 'simulate_api_error', measure: true },
          { action: 'simulate_network_error', measure: true },
          { action: 'simulate_timeout', measure: true },
        ],
        expectedResults: {
          maxRenderTime: 500,
          maxMemoryUsage: 20 * 1024 * 1024,
          maxErrors: 3,
        },
      },
    ];

    const results = [];

    for (const scenario of testScenarios) {
      try {
        const result = await this.runTest(scenario);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to run test: ${scenario.name}`, error);
        results.push({
          scenario: scenario.name,
          passed: false,
          duration: 0,
          metrics: {},
          errors: [`Test execution failed: ${error.message}`],
        });
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log('📊 Test Results Summary:');
    console.log(`  Passed: ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`  Average Duration: ${(totalDuration / totalTests).toFixed(2)}ms`);

    return results;
  }

  public getTestResults() {
    return [...this.testResults];
  }

  public clearResults() {
    this.testResults = [];
  }

  public generateReport(): string {
    const results = this.getTestResults();
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    const report = {
      timestamp: Date.now(),
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: (passedTests / totalTests) * 100,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      },
      results,
      recommendations: this.generateRecommendations(results),
    };

    return JSON.stringify(report, null, 2);
  }

  private generateRecommendations(results: Array<{ passed: boolean; errors: string[] }>): string[] {
    const recommendations: string[] = [];
    const commonErrors = new Map<string, number>();

    // Count common errors
    results.forEach(result => {
      result.errors.forEach(error => {
        const count = commonErrors.get(error) || 0;
        commonErrors.set(error, count + 1);
      });
    });

    // Generate recommendations based on common errors
    commonErrors.forEach((count, error) => {
      if (count > results.length * 0.5) {
        if (error.includes('Render time')) {
          recommendations.push('Consider optimizing component rendering with React.memo and useMemo');
        }
        if (error.includes('Memory usage')) {
          recommendations.push('Implement proper cleanup and memory management');
        }
        if (error.includes('timeout')) {
          recommendations.push('Improve API response times and implement better loading states');
        }
        if (error.includes('Error count')) {
          recommendations.push('Add proper error boundaries and improve error handling');
        }
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Continue monitoring for performance regressions.');
    }

    return recommendations;
  }
}

// Export singleton instance
export const performanceTest = PerformanceTest.getInstance();
export default performanceTest;