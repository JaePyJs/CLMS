#!/usr/bin/env ts-node

/**
 * API Testing Framework Validation Script
 *
 * This script validates that the API testing framework is properly set up
 * and ready to use. It checks dependencies, configuration, and connectivity.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

class ApiTestValidator {
  private projectRoot: string;
  private results: ValidationResult[] = [];

  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  async validate(): Promise<void> {
    console.log('🔍 CLMS API Testing Framework Validation');
    console.log('='.repeat(50));

    try {
      // Check all components
      await this.checkDependencies();
      await this.checkTestFiles();
      await this.checkConfiguration();
      await this.checkDatabaseConnectivity();
      await this.checkEnvironmentVariables();
      await this.checkFileStructure();

      // Display results
      this.displayResults();

      // Exit with appropriate code
      const failedCount = this.results.filter(r => r.status === 'fail').length;
      if (failedCount > 0) {
        console.log(`\n❌ Validation failed with ${failedCount} error(s)`);
        process.exit(1);
      } else {
        console.log('\n✅ All validations passed! Framework is ready to use.');
      }

    } catch (error) {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    }
  }

  private async checkDependencies(): Promise<void> {
    console.log('\n📦 Checking dependencies...');

    const requiredPackages = [
      '@prisma/client',
      'supertest',
      'vitest',
      '@faker-js/faker',
      'commander',
      'ts-node'
    ];

    for (const pkg of requiredPackages) {
      try {
        require.resolve(pkg);
        this.addResult('Dependencies', 'pass', `${pkg} is installed`);
      } catch {
        this.addResult('Dependencies', 'fail', `${pkg} is missing`, {
          solution: `npm install ${pkg} --save-dev`
        });
      }
    }

    // Check package.json scripts
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      const requiredScripts = ['test', 'test:api', 'test:performance'];
      const missingScripts = requiredScripts.filter(script => !packageJson.scripts?.[script]);

      if (missingScripts.length === 0) {
        this.addResult('Dependencies', 'pass', 'All required npm scripts are present');
      } else {
        this.addResult('Dependencies', 'warn', 'Missing npm scripts', {
          missing: missingScripts,
          solution: 'Add missing scripts to package.json'
        });
      }

    } catch (error) {
      this.addResult('Dependencies', 'fail', 'Could not read package.json');
    }
  }

  private async checkTestFiles(): Promise<void> {
    console.log('\n📁 Checking test files...');

    const requiredFiles = [
      'src/tests/integration/api-integration.test.ts',
      'src/tests/performance/load-testing.test.ts',
      'src/tests/utils/testDatabase.ts',
      'src/tests/utils/authHelpers.ts',
      'src/tests/utils/mockDataGenerator.ts',
      'src/tests/setup-api-tests.ts',
      'src/tests/run-api-tests.ts',
      'vitest.config.ts',
      'vitest.performance.config.ts'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      try {
        await fs.access(filePath);
        this.addResult('Test Files', 'pass', `${file} exists`);
      } catch {
        this.addResult('Test Files', 'fail', `${file} is missing`);
      }
    }
  }

  private async checkConfiguration(): Promise<void> {
    console.log('\n⚙️  Checking configuration...');

    // Check Vitest configuration
    try {
      const vitestConfigPath = path.join(this.projectRoot, 'vitest.config.ts');
      await fs.access(vitestConfigPath);
      this.addResult('Configuration', 'pass', 'vitest.config.ts exists');
    } catch {
      this.addResult('Configuration', 'fail', 'vitest.config.ts is missing');
    }

    try {
      const perfConfigPath = path.join(this.projectRoot, 'vitest.performance.config.ts');
      await fs.access(perfConfigPath);
      this.addResult('Configuration', 'pass', 'vitest.performance.config.ts exists');
    } catch {
      this.addResult('Configuration', 'fail', 'vitest.performance.config.ts is missing');
    }

    // Check TypeScript configuration
    try {
      const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
      const tsConfig = JSON.parse(await fs.readFile(tsConfigPath, 'utf8'));

      if (tsConfig.compilerOptions?.esModuleInterop) {
        this.addResult('Configuration', 'pass', 'TypeScript configuration is correct');
      } else {
        this.addResult('Configuration', 'warn', 'TypeScript configuration may need adjustments', {
          solution: 'Ensure esModuleInterop is enabled in tsconfig.json'
        });
      }
    } catch (error) {
      this.addResult('Configuration', 'warn', 'Could not validate TypeScript configuration');
    }
  }

  private async checkDatabaseConnectivity(): Promise<void> {
    console.log('\n🗄️  Checking database connectivity...');

    if (!process.env.DATABASE_URL) {
      this.addResult('Database', 'fail', 'DATABASE_URL environment variable is not set', {
        solution: 'Set DATABASE_URL in your environment or .env file'
      });
      return;
    }

    try {
      // Try to import and test Prisma connection
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();

      this.addResult('Database', 'pass', 'Database connection successful');
    } catch (error) {
      this.addResult('Database', 'fail', 'Database connection failed', {
        error: error.message,
        solution: 'Check database URL, ensure MySQL is running, and verify credentials'
      });
    }
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('\n🌍 Checking environment variables...');

    const requiredEnvVars = [
      'DATABASE_URL',
      'NODE_ENV'
    ];

    const optionalEnvVars = [
      'JWT_SECRET',
      'BCRYPT_ROUNDS',
      'TEST_LOGGING',
      'ENABLE_LOAD_TESTS'
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.addResult('Environment', 'pass', `${envVar} is set`);
      } else {
        this.addResult('Environment', 'fail', `${envVar} is not set`, {
          solution: `Set ${envVar} in your environment or .env file`
        });
      }
    }

    for (const envVar of optionalEnvVars) {
      if (process.env[envVar]) {
        this.addResult('Environment', 'pass', `${envVar} is set (optional)`);
      } else {
        this.addResult('Environment', 'warn', `${envVar} is not set (optional)`, {
          solution: `Consider setting ${envVar} for better test configuration`
        });
      }
    }
  }

  private async checkFileStructure(): Promise<void> {
    console.log('\n📂 Checking file structure...');

    const requiredDirectories = [
      'src/tests',
      'src/tests/integration',
      'src/tests/performance',
      'src/tests/utils',
      'test-results'
    ];

    for (const dir of requiredDirectories) {
      const dirPath = path.join(this.projectRoot, dir);
      try {
        await fs.access(dirPath);
        this.addResult('File Structure', 'pass', `${dir}/ exists`);
      } catch {
        try {
          await fs.mkdir(dirPath, { recursive: true });
          this.addResult('File Structure', 'pass', `${dir}/ created`);
        } catch {
          this.addResult('File Structure', 'warn', `${dir}/ is missing but could not be created`);
        }
      }
    }

    // Check documentation files
    const docFiles = [
      'API_INTEGRATION_TESTING_GUIDE.md',
      'test-api-framework-summary.md'
    ];

    for (const doc of docFiles) {
      const docPath = path.join(this.projectRoot, doc);
      try {
        await fs.access(docPath);
        this.addResult('File Structure', 'pass', `${doc} exists`);
      } catch {
        this.addResult('File Structure', 'warn', `${doc} is missing`);
      }
    }
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warn', message: string, details?: any): void {
    this.results.push({ component, status, message, details });
  }

  private displayResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(50));

    const grouped = this.results.reduce((acc, result) => {
      if (!acc[result.component]) {
        acc[result.component] = [];
      }
      acc[result.component].push(result);
      return acc;
    }, {} as Record<string, ValidationResult[]>);

    for (const [component, results] of Object.entries(grouped)) {
      console.log(`\n${component}:`);
      results.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
        console.log(`  ${icon} ${result.message}`);
        if (result.details) {
          if (typeof result.details === 'object') {
            Object.entries(result.details).forEach(([key, value]) => {
              console.log(`    ${key}: ${value}`);
            });
          } else {
            console.log(`    ${result.details}`);
          }
        }
      });
    }

    // Summary
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;

    console.log('\n' + '='.repeat(50));
    console.log('📈 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total checks: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (warnings > 0) {
      console.log('\n⚠️  Warnings detected. Review and consider addressing them for optimal performance.');
    }

    if (failed > 0) {
      console.log('\n❌ Errors detected. Please address these issues before running tests.');
    }
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  const validator = new ApiTestValidator();
  validator.validate();
}

export { ApiTestValidator };