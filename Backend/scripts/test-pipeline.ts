#!/usr/bin/env tsx

/**
 * CLMS Automated Test Execution Pipeline
 *
 * This script provides comprehensive test execution automation including:
 * - Unit tests
 * - Integration tests
 * - WebSocket tests
 * - Analytics tests
 * - Security tests
 * - Performance tests
 * - End-to-end tests
 * - Load testing
 * - Test reporting and analysis
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

interface TestSuite {
  name: string;
  command: string;
  timeout: number;
  critical: boolean;
  parallelizable: boolean;
}

interface TestResult {
  suite: string;
  success: boolean;
  duration: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

interface PipelineConfig {
  suites: TestSuite[];
  parallelGroups: string[][];
  retries: number;
  bailOnCriticalFailure: boolean;
  generateReports: boolean;
  notifyOnFailure: boolean;
}

class CLMSTestPipeline {
  private config: PipelineConfig;
  private results: TestResult[] = [];
  private start_time: number = 0;
  private reportsDir: string;

  constructor(config?: Partial<PipelineConfig>) {
    this.reportsDir = join(process.cwd(), 'test-reports');
    this.ensureReportsDirectory();

    this.config = {
      suites: this.getDefaultTestSuites(),
      parallelGroups: [
        ['unit', 'services'],
        ['websocket', 'analytics'],
        ['security'],
        ['integration'],
        ['e2e'],
        ['performance', 'load']
      ],
      retries: 1,
      bailOnCriticalFailure: true,
      generateReports: true,
      notifyOnFailure: true,
      ...config
    };
  }

  private getDefaultTestSuites(): TestSuite[] {
    return [
      {
        name: 'unit',
        command: 'npm run test',
        timeout: 60000,
        critical: true,
        parallelizable: true
      },
      {
        name: 'services',
        command: 'npm run test -- src/tests/services',
        timeout: 120000,
        critical: true,
        parallelizable: true
      },
      {
        name: 'websocket',
        command: 'npm run test:websocket',
        timeout: 180000,
        critical: true,
        parallelizable: true
      },
      {
        name: 'analytics',
        command: 'npm run test:analytics',
        timeout: 300000,
        critical: true,
        parallelizable: true
      },
      {
        name: 'security',
        command: 'npm run test:security',
        timeout: 240000,
        critical: true,
        parallelizable: true
      },
      {
        name: 'integration',
        command: 'npm run test:integration',
        timeout: 600000,
        critical: true,
        parallelizable: false
      },
      {
        name: 'e2e',
        command: 'npm run test:e2e',
        timeout: 900000,
        critical: true,
        parallelizable: false
      },
      {
        name: 'mobile',
        command: 'npm run test:mobile',
        timeout: 300000,
        critical: false,
        parallelizable: true
      },
      {
        name: 'performance',
        command: 'npm run test:performance',
        timeout: 600000,
        critical: false,
        parallelizable: false
      },
      {
        name: 'load',
        command: 'npm run test:load',
        timeout: 1200000,
        critical: false,
        parallelizable: false
      }
    ];
  }

  private ensureReportsDirectory(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['unit', 'integration', 'e2e', 'websocket', 'analytics', 'security', 'performance'];
    subdirs.forEach(dir => {
      const fullPath = join(this.reportsDir, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async runPipeline(): Promise<void> {
    console.log('🚀 Starting CLMS Automated Test Execution Pipeline');
    console.log('='.repeat(60));
    this.start_time = performance.now();

    try {
      // Pre-flight checks
      await this.runPreflightChecks();

      // Run test suites in parallel groups
      for (const group of this.config.parallelGroups) {
        await this.runParallelGroup(group);
      }

      // Generate comprehensive report
      if (this.config.generateReports) {
        await this.generateComprehensiveReport();
      }

      // Check overall success
      const overallSuccess = this.checkOverallSuccess();

      if (overallSuccess) {
        console.log('\n✅ All tests passed successfully!');
        this.printSummary();
      } else {
        console.log('\n❌ Some tests failed. Check the report for details.');
        this.printSummary();
        process.exit(1);
      }

    } catch (error) {
      console.error('\n💥 Pipeline execution failed:', error);
      process.exit(1);
    }
  }

  private async runPreflightChecks(): Promise<void> {
    console.log('\n🔍 Running pre-flight checks...');

    const checks = [
      {
        name: 'Database connection',
        command: 'npm run db:generate && npm run db:push',
        timeout: 60000
      },
      {
        name: 'Dependencies installation',
        command: 'npm ci',
        timeout: 120000
      },
      {
        name: 'TypeScript compilation',
        command: 'npm run build',
        timeout: 120000
      }
    ];

    for (const check of checks) {
      console.log(`  ⏳ Running ${check.name}...`);
      try {
        execSync(check.command, {
          stdio: 'pipe',
          timeout: check.timeout
        });
        console.log(`  ✅ ${check.name} passed`);
      } catch (error) {
        console.error(`  ❌ ${check.name} failed:`, error.message);
        throw new Error(`Pre-flight check failed: ${check.name}`);
      }
    }
  }

  private async runParallelGroup(group: string[]): Promise<void> {
    console.log(`\n🔄 Running test group: ${group.join(', ')}`);
    console.log('-'.repeat(40));

    const groupSuites = this.config.suites.filter(suite => group.includes(suite.name));

    if (groupSuites.every(suite => suite.parallelizable)) {
      // Run parallelizable suites in parallel
      const promises = groupSuites.map(suite => this.runTestSuite(suite));
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ ${groupSuites[index].name} failed:`, result.reason);
        }
      });

      // Check for critical failures
      const criticalFailures = results.filter((result, index) =>
        result.status === 'rejected' && groupSuites[index].critical
      );

      if (criticalFailures.length > 0 && this.config.bailOnCriticalFailure) {
        throw new Error('Critical test suite failed, aborting pipeline');
      }

    } else {
      // Run non-parallelizable suites sequentially
      for (const suite of groupSuites) {
        await this.runTestSuite(suite);
      }
    }
  }

  private async runTestSuite(suite: TestSuite, attempt: number = 1): Promise<TestResult> {
    console.log(`\n🧪 Running ${suite.name} test suite (attempt ${attempt})...`);

    const startTime = performance.now();

    try {
      const { stdout, stderr } = execSync(suite.command, {
        stdio: 'pipe',
        timeout: suite.timeout,
        encoding: 'utf8'
      });

      const duration = performance.now() - startTime;
      const result: TestResult = {
        suite: suite.name,
        success: true,
        duration,
        exitCode: 0,
        stdout,
        stderr
      };

      this.results.push(result);
      console.log(`✅ ${suite.name} passed (${duration.toFixed(0)}ms)`);

      // Save individual test report
      this.saveTestReport(suite.name, result);

      return result;

    } catch (error: any) {
      const duration = performance.now() - startTime;
      const result: TestResult = {
        suite: suite.name,
        success: false,
        duration,
        exitCode: error.status || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        error: error.message
      };

      console.log(`❌ ${suite.name} failed (${duration.toFixed(0)}ms): ${error.message}`);

      // Retry logic
      if (attempt < this.config.retries) {
        console.log(`🔄 Retrying ${suite.name} (attempt ${attempt + 1}/${this.config.retries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        return this.runTestSuite(suite, attempt + 1);
      }

      this.results.push(result);
      this.saveTestReport(suite.name, result);

      if (suite.critical && this.config.bailOnCriticalFailure) {
        throw new Error(`Critical test suite ${suite.name} failed`);
      }

      return result;
    }
  }

  private saveTestReport(suiteName: string, result: TestResult): void {
    const reportData = {
      suite: suiteName,
      timestamp: new Date().toISOString(),
      success: result.success,
      duration: result.duration,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error
    };

    const reportPath = join(this.reportsDir, suiteName, `${suiteName}-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  }

  private async generateComprehensiveReport(): Promise<void> {
    console.log('\n📊 Generating comprehensive test report...');

    const totalDuration = performance.now() - this.start_time;
    const successfulSuites = this.results.filter(r => r.success);
    const failedSuites = this.results.filter(r => !r.success);
    const criticalFailures = failedSuites.filter(r => {
      const suite = this.config.suites.find(s => s.name === r.suite);
      return suite?.critical;
    });

    const report = {
      metadata: { id: crypto.randomUUID(), updated_at: new Date(), 
        timestamp: new Date().toISOString(),
        totalDuration,
        totalSuites: this.results.length,
        successfulSuites: successfulSuites.length,
        failedSuites: failedSuites.length,
        criticalFailures: criticalFailures.length,
        successRate: (successfulSuites.length / this.results.length) * 100
      },
      summary: {
        byCategory: this.groupResultsByCategory(),
        performanceMetrics: this.calculatePerformanceMetrics(),
        coverageMetrics: this.calculateCoverageMetrics(),
        recommendations: this.generateRecommendations(failedSuites)
      },
      detailedResults: this.results.map(r => ({
        suite: r.suite,
        success: r.success,
        duration: r.duration,
        exitCode: r.exitCode,
        critical: this.config.suites.find(s => s.name === r.suite)?.critical || false,
        error: r.error,
        summary: this.generateTestSummary(r)
      }))
    };

    // Save comprehensive report
    const reportPath = join(this.reportsDir, `comprehensive-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save HTML report
    const htmlReport = this.generateHTMLReport(report);
    const htmlPath = join(this.reportsDir, `test-report-${Date.now()}.html`);
    writeFileSync(htmlPath, htmlReport);

    console.log(`📄 Comprehensive report saved: ${reportPath}`);
    console.log(`🌐 HTML report saved: ${htmlPath}`);
  }

  private groupResultsByCategory(): any {
    const categories = {
      'Unit Tests': ['unit', 'services'],
      'Integration Tests': ['integration', 'websocket', 'analytics'],
      'End-to-End Tests': ['e2e', 'mobile'],
      'Quality Tests': ['security'],
      'Performance Tests': ['performance', 'load']
    };

    const grouped: any = {};

    Object.entries(categories).forEach(([category, suites]) => {
      const categoryResults = this.results.filter(r => suites.includes(r.suite));
      grouped[category] = {
        total: categoryResults.length,
        successful: categoryResults.filter(r => r.success).length,
        failed: categoryResults.filter(r => !r.success).length,
        averageDuration: categoryResults.reduce((sum, r) => sum + r.duration, 0) / categoryResults.length
      };
    });

    return grouped;
  }

  private calculatePerformanceMetrics(): any {
    const durations = this.results.map(r => r.duration);

    return {
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      averageSuiteDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      fastestSuite: Math.min(...durations),
      slowestSuite: Math.max(...durations),
      totalTestTime: performance.now() - this.start_time
    };
  }

  private calculateCoverageMetrics(): any {
    // Try to extract coverage information from test results
    const coverageFiles = [
      join(this.reportsDir, 'coverage', 'coverage-summary.json'),
      join(process.cwd(), 'coverage', 'coverage-summary.json')
    ];

    for (const file of coverageFiles) {
      if (existsSync(file)) {
        try {
          const coverageData = JSON.parse(readFileSync(file, 'utf8'));
          return {
            lines: coverageData.total?.lines?.pct || 0,
            functions: coverageData.total?.functions?.pct || 0,
            branches: coverageData.total?.branches?.pct || 0,
            statements: coverageData.total?.statements?.pct || 0
          };
        } catch (error) {
          // Ignore coverage file errors
        }
      }
    }

    return { lines: 0, functions: 0, branches: 0, statements: 0 };
  }

  private generateRecommendations(failedSuites: TestResult[]): string[] {
    const recommendations: string[] = [];

    failedSuites.forEach(failure => {
      if (failure.stderr?.includes('ECONNREFUSED')) {
        recommendations.push('Database connection issues detected. Ensure database is running and accessible.');
      }

      if (failure.stderr?.includes('timeout')) {
        recommendations.push(`${failure.suite} tests are timing out. Consider optimizing test performance or increasing timeouts.`);
      }

      if (failure.stderr?.includes('module not found')) {
        recommendations.push(`Missing dependencies detected. Run 'npm install' to install required packages.`);
      }

      if (failure.suite === 'unit' || failure.suite === 'services') {
        recommendations.push('Unit test failures indicate potential issues with core functionality. Review failed tests and fix underlying bugs.');
      }

      if (failure.suite === 'integration') {
        recommendations.push('Integration test failures suggest issues with component interactions. Check API endpoints and service integration.');
      }

      if (failure.suite === 'websocket') {
        recommendations.push('WebSocket test failures indicate real-time functionality issues. Verify WebSocket server and client implementations.');
      }

      if (failure.suite === 'security') {
        recommendations.push('Security test failures highlight potential vulnerabilities. Address security concerns before deployment.');
      }

      if (failure.suite === 'performance') {
        recommendations.push('Performance test failures indicate performance regressions. Profile and optimize slow operations.');
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Review test output for specific failure details and address accordingly.');
    }

    return recommendations;
  }

  private generateTestSummary(result: TestResult): string {
    if (result.success) {
      return `All tests passed in ${result.duration.toFixed(0)}ms`;
    } else {
      const lines = result.stderr.split('\n').filter(line => line.trim());
      const errorLines = lines.slice(0, 3); // First 3 lines of error
      return `Failed with exit code ${result.exitCode}: ${errorLines.join('; ')}`;
    }
  }

  private generateHTMLReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLMS Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #495057; }
        .metric .value { font-size: 24px; font-weight: bold; }
        .test-results { margin: 30px 0; }
        .test-suite { border: 1px solid #dee2e6; border-radius: 5px; margin: 10px 0; overflow: hidden; }
        .test-suite-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; }
        .test-suite-body { padding: 15px; }
        .status-success { background-color: #d4edda; }
        .status-failure { background-color: #f8d7da; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .recommendations h3 { margin-top: 0; }
        .recommendations ul { margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CLMS Test Execution Report</h1>
            <p>Generated on ${new Date(report.metadata.timestamp).toLocaleString()}</p>
        </div>

        <div class="metrics">
            <div class="metric">
                <h3>Total Duration</h3>
                <div class="value">${(report.summary.performanceMetrics.totalTestTime / 1000).toFixed(1)}s</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value ${report.metadata.successRate === 100 ? 'success' : report.metadata.successRate >= 80 ? 'warning' : 'failure'}">
                    ${report.metadata.successRate.toFixed(1)}%
                </div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value success">${report.metadata.successfulSuites}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failure">${report.metadata.failedSuites}</div>
            </div>
            <div class="metric">
                <h3>Coverage</h3>
                <div class="value">${report.summary.coverageMetrics.lines.toFixed(1)}%</div>
            </div>
        </div>

        <div class="test-results">
            <h2>Test Suite Results</h2>
            ${report.detailedResults.map(result => `
                <div class="test-suite">
                    <div class="test-suite-header ${result.success ? 'status-success' : 'status-failure'}">
                        <h3>${result.suite} ${result.critical ? '(Critical)' : ''}</h3>
                        <span>${result.success ? '✅ PASSED' : '❌ FAILED'} (${result.duration.toFixed(0)}ms)</span>
                    </div>
                    <div class="test-suite-body">
                        <p>${result.summary}</p>
                        ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        ${report.summary.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>Recommendations</h3>
                <ul>
                    ${report.summary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        <div class="test-results">
            <h2>Results by Category</h2>
            ${Object.entries(report.summary.byCategory).map(([category, metrics]: [string, any]) => `
                <div class="metric">
                    <h3>${category}</h3>
                    <div class="value">${metrics.successful}/${metrics.total} passed</div>
                    <small>Avg: ${(metrics.averageDuration / 1000).toFixed(1)}s</small>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
  }

  private checkOverallSuccess(): boolean {
    const criticalFailures = this.results.filter(r => {
      const suite = this.config.suites.find(s => s.name === r.suite);
      return !r.success && suite?.critical;
    });

    return criticalFailures.length === 0;
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));

    const totalDuration = performance.now() - this.start_time;
    const successfulSuites = this.results.filter(r => r.success);
    const failedSuites = this.results.filter(r => !r.success);

    console.log(`\n📈 Overall Results:`);
    console.log(`  Total Suites: ${this.results.length}`);
    console.log(`  Successful: ${successfulSuites.length}`);
    console.log(`  Failed: ${failedSuites.length}`);
    console.log(`  Success Rate: ${((successfulSuites.length / this.results.length) * 100).toFixed(1)}%`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    console.log(`\n⏱️  Performance Metrics:`);
    console.log(`  Average Suite Duration: ${(this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length / 1000).toFixed(1)}s`);
    console.log(`  Fastest Suite: ${Math.min(...this.results.map(r => r.duration)) / 1000}s`);
    console.log(`  Slowest Suite: ${Math.max(...this.results.map(r => r.duration)) / 1000}s`);

    if (failedSuites.length > 0) {
      console.log(`\n❌ Failed Suites:`);
      failedSuites.forEach(suite => {
        const suiteConfig = this.config.suites.find(s => s.name === suite.suite);
        const critical = suiteConfig?.critical ? ' (CRITICAL)' : '';
        console.log(`  - ${suite.suite}${critical}: ${suite.error || 'Unknown error'}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const config: Partial<PipelineConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--no-bail') {
      config.bailOnCriticalFailure = false;
    } else if (arg === '--no-reports') {
      config.generateReports = false;
    } else if (arg.startsWith('--retries=')) {
      config.retries = parseInt(arg.split('=')[1]) || 1;
    } else if (arg === '--suite') {
      // Run specific suite
      const suiteName = args[++i];
      if (suiteName) {
        const pipeline = new CLMSTestPipeline();
        const suite = pipeline['config'].suites.find((s: TestSuite) => s.name === suiteName);
        if (suite) {
          await pipeline.runTestSuite(suite);
        } else {
          console.error(`Unknown suite: ${suiteName}`);
          process.exit(1);
        }
        return;
      }
    } else if (arg === '--help') {
      console.log(`
CLMS Test Pipeline Options:
  --no-bail          Don't stop on critical failures
  --no-reports       Don't generate reports
  --retries=N       Number of retries for failed tests (default: 1)
  --suite NAME       Run only the specified test suite
  --help             Show this help message

Available suites: ${new CLMSTestPipeline()['config'].suites.map((s: TestSuite) => s.name).join(', ')}
      `);
      process.exit(0);
    }
  }

  const pipeline = new CLMSTestPipeline(config);

  try {
    await pipeline.runPipeline();
  } catch (error) {
    console.error('Pipeline execution failed:', error);
    process.exit(1);
  }
}

// Run pipeline if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { CLMSTestPipeline, type TestSuite, type TestResult, type PipelineConfig };
export default CLMSTestPipeline;