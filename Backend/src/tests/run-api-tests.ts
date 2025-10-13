#!/usr/bin/env ts-node

/**
 * Comprehensive API Test Runner
 *
 * This script runs all API integration tests with proper setup,
 * teardown, and reporting. It can be used for CI/CD pipelines
 * or local development testing.
 */

import { spawn } from 'child_process';
import { program } from 'commander';
import path from 'path';
import fs from 'fs/promises';

interface TestOptions {
  suite: string;
  coverage: boolean;
  watch: boolean;
  verbose: boolean;
  performance: boolean;
  bail: boolean;
  reporters: string[];
  timeout: number;
  parallel: boolean;
  maxWorkers: number;
}

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  tests: number;
  passed: number;
  failed: number;
  coverage?: any;
  error?: string;
}

class ApiTestRunner {
  private projectRoot: string;
  private testResults: TestResult[] = [];

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
  }

  /**
   * Run the API test suite
   */
  async runTests(options: TestOptions): Promise<void> {
    console.log('🚀 Starting CLMS API Test Runner');
    console.log(`📋 Test Suite: ${options.suite}`);
    console.log(`📊 Coverage: ${options.coverage ? 'Enabled' : 'Disabled'}`);
    console.log(`⚡ Performance Tests: ${options.performance ? 'Enabled' : 'Disabled'}`);
    console.log(`👀 Watch Mode: ${options.watch ? 'Enabled' : 'Disabled'}`);
    console.log('');

    try {
      // Validate environment
      await this.validateEnvironment();

      // Setup test environment
      await this.setupTestEnvironment();

      // Run tests based on suite selection
      if (options.suite === 'all') {
        await this.runAllTestSuites(options);
      } else {
        await this.runSpecificSuite(options.suite, options);
      }

      // Generate reports
      await this.generateReports(options);

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  /**
   * Validate that the test environment is properly configured
   */
  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating test environment...');

    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Check if database is accessible
    try {
      await this.checkDatabaseConnection();
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Check if dependencies are installed
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    const requiredDeps = ['@prisma/client', 'supertest', 'vitest'];
    const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies && !packageJson.devDependencies);

    if (missingDeps.length > 0) {
      throw new Error(`Missing required dependencies: ${missingDeps.join(', ')}`);
    }

    console.log('✅ Environment validation completed');
  }

  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<void> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      await prisma.$queryRaw`SELECT 1`;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    console.log('⚙️  Setting up test environment...');

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.BCRYPT_ROUNDS = '4';

    // Create temp directory for test artifacts
    const tempDir = path.join(this.projectRoot, 'temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // Directory already exists
    }

    console.log('✅ Test environment setup completed');
  }

  /**
   * Run all test suites
   */
  private async runAllTestSuites(options: TestOptions): Promise<void> {
    const suites = [
      { name: 'unit', description: 'Unit Tests' },
      { name: 'integration', description: 'Integration Tests' },
      { name: 'api', description: 'API Integration Tests' },
      { name: 'auth', description: 'Authentication Tests' },
      { name: 'performance', description: 'Performance Tests' }
    ];

    if (options.performance) {
      suites.push({ name: 'load', description: 'Load Testing' });
    }

    for (const suite of suites) {
      console.log(`\n📦 Running ${suite.description}...`);
      const result = await this.runTestSuite(suite.name, options);
      this.testResults.push(result);

      if (options.bail && result.status === 'failed') {
        console.log(`\n💥 Test suite "${suite.name}" failed. Bailing due to --bail flag.`);
        break;
      }
    }
  }

  /**
   * Run a specific test suite
   */
  private async runSpecificSuite(suiteName: string, options: TestOptions): Promise<void> {
    console.log(`\n📦 Running test suite: ${suiteName}`);
    const result = await this.runTestSuite(suiteName, options);
    this.testResults.push(result);
  }

  /**
   * Run individual test suite using Vitest
   */
  private async runTestSuite(suiteName: string, options: TestOptions): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Determine test pattern based on suite
      const testPattern = this.getTestPattern(suiteName);
      const configPath = this.getConfigPath(suiteName);

      // Build Vitest command arguments
      const vitestArgs = [
        'run',
        testPattern,
        '--config', configPath,
        '--reporter=verbose',
        `--timeout=${options.timeout}`
      ];

      if (options.coverage) {
        vitestArgs.push('--coverage');
      }

      if (options.watch) {
        vitestArgs[0] = 'watch'; // Replace 'run' with 'watch'
      }

      if (options.parallel) {
        vitestArgs.push('--threads');
        vitestArgs.push(`--maxWorkers=${options.maxWorkers}`);
      } else {
        vitestArgs.push('--no-threads');
        vitestArgs.push('--single-thread');
      }

      for (const reporter of options.reporters) {
        vitestArgs.push('--reporter', reporter);
      }

      // Run Vitest
      const result = await this.executeCommand('npx', ['vitest', ...vitestArgs], {
        cwd: this.projectRoot,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_LOGGING: options.verbose ? 'true' : 'false',
          ENABLE_LOAD_TESTS: options.performance ? 'true' : 'false'
        }
      });

      const duration = Date.now() - startTime;

      // Parse results from output
      const parsedResults = this.parseTestOutput(result.stdout, suiteName);

      return {
        suite: suiteName,
        status: result.exitCode === 0 ? 'passed' : 'failed',
        duration,
        ...parsedResults
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        suite: suiteName,
        status: 'failed',
        duration,
        tests: 0,
        passed: 0,
        failed: 1,
        error: error.message
      };
    }
  }

  /**
   * Get test pattern for suite
   */
  private getTestPattern(suiteName: string): string {
    const patterns: Record<string, string> = {
      unit: 'src/tests/unit/**/*.test.ts',
      integration: 'src/tests/integration/**/*.test.ts',
      api: 'src/tests/integration/api-integration.test.ts',
      auth: 'src/tests/auth/**/*.test.ts',
      performance: 'src/tests/performance/**/*.test.ts',
      load: 'src/tests/performance/load-testing.test.ts'
    };

    return patterns[suiteName] || `src/tests/**/${suiteName}*.test.ts`;
  }

  /**
   * Get config path for suite
   */
  private getConfigPath(suiteName: string): string {
    const configs: Record<string, string> = {
      load: 'vitest.performance.config.ts',
      performance: 'vitest.performance.config.ts'
    };

    return configs[suiteName] || 'vitest.config.ts';
  }

  /**
   * Execute command and return result
   */
  private async executeCommand(
    command: string,
    args: string[],
    options: { cwd: string; env?: Record<string, string> }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({ exitCode: exitCode || 0, stdout, stderr });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse test output to extract metrics
   */
  private parseTestOutput(output: string, suiteName: string): { tests: number; passed: number; failed: number } {
    // Look for test summary in Vitest output
    const summaryMatch = output.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)\s*[\r\n]+.*?Tests\s+(\d+)\s+\((\d+)\)/s);

    if (summaryMatch) {
      return {
        tests: parseInt(summaryMatch[3]),
        passed: parseInt(summaryMatch[4]),
        failed: parseInt(summaryMatch[3]) - parseInt(summaryMatch[4])
      };
    }

    // Fallback: look for any test indicators
    const testMatches = output.match(/✓|✗|PASS|FAIL/g);
    const testCount = testMatches ? testMatches.length : 0;
    const passedMatches = output.match(/✓|PASS/g);
    const passedCount = passedMatches ? passedMatches.length : 0;

    return {
      tests: testCount,
      passed: passedCount,
      failed: testCount - passedCount
    };
  }

  /**
   * Generate test reports
   */
  private async generateReports(options: TestOptions): Promise<void> {
    console.log('\n📊 Generating test reports...');

    // Generate JSON report
    await this.generateJsonReport();

    // Generate HTML report (if coverage enabled)
    if (options.coverage) {
      await this.generateHtmlCoverageReport();
    }

    // Generate performance report
    if (options.performance) {
      await this.generatePerformanceReport();
    }

    console.log('✅ Report generation completed');
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'test-results', 'api-test-report.json');

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });

      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalSuites: this.testResults.length,
          passedSuites: this.testResults.filter(r => r.status === 'passed').length,
          failedSuites: this.testResults.filter(r => r.status === 'failed').length,
          totalTests: this.testResults.reduce((sum, r) => sum + r.tests, 0),
          totalPassed: this.testResults.reduce((sum, r) => sum + r.passed, 0),
          totalFailed: this.testResults.reduce((sum, r) => sum + r.failed, 0),
          totalDuration: this.testResults.reduce((sum, r) => sum + r.duration, 0)
        },
        suites: this.testResults
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 JSON report generated: ${reportPath}`);

    } catch (error) {
      console.warn('Failed to generate JSON report:', error.message);
    }
  }

  /**
   * Generate HTML coverage report
   */
  private async generateHtmlCoverageReport(): Promise<void> {
    // Coverage reports are generated by Vitest in coverage/ directory
    const coverageDir = path.join(this.projectRoot, 'coverage');

    try {
      await fs.access(coverageDir);
      console.log(`📄 HTML coverage report available: ${coverageDir}/index.html`);
    } catch {
      console.warn('Coverage report not found');
    }
  }

  /**
   * Generate performance report
   */
  private async generatePerformanceReport(): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'test-results', 'performance-report.json');

    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });

      const performanceResults = this.testResults.filter(r => r.suite.includes('performance') || r.suite.includes('load'));

      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalPerformanceTests: performanceResults.length,
          averageResponseTime: performanceResults.reduce((sum, r) => sum + r.duration, 0) / performanceResults.length,
          slowestTest: Math.max(...performanceResults.map(r => r.duration)),
          fastestTest: Math.min(...performanceResults.map(r => r.duration))
        },
        results: performanceResults
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Performance report generated: ${reportPath}`);

    } catch (error) {
      console.warn('Failed to generate performance report:', error.message);
    }
  }

  /**
   * Display test results summary
   */
  private displayResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CLMS API TEST RESULTS');
    console.log('='.repeat(80));

    const totalSuites = this.testResults.length;
    const passedSuites = this.testResults.filter(r => r.status === 'passed').length;
    const failedSuites = this.testResults.filter(r => r.status === 'failed').length;
    const totalTests = this.testResults.reduce((sum, r) => sum + r.tests, 0);
    const totalPassed = this.testResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.testResults.reduce((sum, r) => sum + r.failed, 0);
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n📈 OVERALL SUMMARY:`);
    console.log(`   Test Suites: ${passedSuites}/${totalSuites} passed`);
    console.log(`   Tests: ${totalPassed}/${totalTests} passed`);
    console.log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Success Rate: ${totalSuites > 0 ? ((passedSuites / totalSuites) * 100).toFixed(1) : 0}%`);

    console.log(`\n📋 SUITE DETAILS:`);
    this.testResults.forEach(result => {
      const status = result.status === 'passed' ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      const successRate = result.tests > 0 ? ((result.passed / result.tests) * 100).toFixed(1) : '0.0';

      console.log(`   ${status} ${result.suite.padEnd(15)} | ${result.tests.toString().padStart(4)} tests | ${successRate.padStart(6)}% | ${duration.padStart(6)}s`);

      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(80));

    if (failedSuites > 0) {
      console.log(`\n❌ ${failedSuites} test suite(s) failed. Check the logs above for details.`);
      process.exit(1);
    } else {
      console.log(`\n✅ All test suites passed successfully!`);
    }
  }

  /**
   * Cleanup test artifacts
   */
  private async cleanup(): Promise<void> {
    try {
      const tempDir = path.join(this.projectRoot, 'temp');
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// CLI Setup
program
  .name('run-api-tests')
  .description('CLMS API Test Runner - Comprehensive API testing suite')
  .version('1.0.0');

program
  .command('run')
  .description('Run API tests')
  .option('-s, --suite <suite>', 'Test suite to run (all|unit|integration|api|auth|performance|load)', 'all')
  .option('-c, --coverage', 'Enable code coverage', false)
  .option('-w, --watch', 'Enable watch mode', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('-p, --performance', 'Include performance and load tests', false)
  .option('-b, --bail', 'Stop on first test failure', false)
  .option('-r, --reporters <reporters>', 'Reporters to use (comma separated)', 'verbose')
  .option('-t, --timeout <timeout>', 'Test timeout in milliseconds', '10000')
  .option('--parallel', 'Run tests in parallel', false)
  .option('--max-workers <workers>', 'Maximum number of workers', '4')
  .action(async (options) => {
    const testOptions: TestOptions = {
      suite: options.suite,
      coverage: options.coverage,
      watch: options.watch,
      verbose: options.verbose,
      performance: options.performance,
      bail: options.bail,
      reporters: options.reporters.split(',').map((r: string) => r.trim()),
      timeout: parseInt(options.timeout),
      parallel: options.parallel,
      maxWorkers: parseInt(options.maxWorkers)
    };

    const runner = new ApiTestRunner();
    await runner.runTests(testOptions);
  });

// Parse command line arguments
program.parse();

// Export for programmatic use
export { ApiTestRunner, TestOptions, TestResult };