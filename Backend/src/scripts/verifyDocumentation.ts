#!/usr/bin/env ts-node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { documentationService } from '../services/documentationService';
import { logger } from '../utils/logger';

interface VerificationResult {
  success: boolean;
  overall: 'healthy' | 'warning' | 'error';
  checks: {
    criticalFiles: boolean;
    syntax: boolean;
    compilation: boolean;
    api: boolean;
    sync: boolean;
  };
  details: {
    missingFiles: string[];
    syntaxErrors: string[];
    compilationErrors: string[];
    apiErrors: string[];
    syncIssues: string[];
  };
  recommendations: string[];
  timestamp: string;
}

class DocumentationVerifier {
  private projectRoot: string;

  constructor() {
    this.projectRoot = join(__dirname, '..', '..', '..');
  }

  async verifyAll(): Promise<VerificationResult> {
    const result: VerificationResult = {
      success: true,
      overall: 'healthy',
      checks: {
        criticalFiles: false,
        syntax: false,
        compilation: false,
        api: false,
        sync: false,
      },
      details: {
        missingFiles: [],
        syntaxErrors: [],
        compilationErrors: [],
        apiErrors: [],
        syncIssues: [],
      },
      recommendations: [],
      timestamp: new Date().toISOString(),
    };

    try {
      logger.info('Starting comprehensive documentation verification...');

      // 1. Check critical files
      result.checks.criticalFiles = await this.checkCriticalFiles(result);

      // 2. Check documentation syntax
      result.checks.syntax = await this.checkDocumentationSyntax(result);

      // 3. Check TypeScript compilation
      result.checks.compilation = await this.checkCompilation(result);

      // 4. Check API endpoints (if server is running)
      result.checks.api = await this.checkApiEndpoints(result);

      // 5. Check documentation synchronization
      result.checks.sync = await this.checkSynchronization(result);

      // 6. Generate recommendations
      this.generateRecommendations(result);

      // 7. Determine overall status
      this.determineOverallStatus(result);

      logger.info(
        `Documentation verification completed: ${result.overall.toUpperCase()}`,
      );
    } catch (error) {
      result.success = false;
      result.overall = 'error';
      result.details.syncIssues.push(
        `Verification failed: ${(error as Error).message}`,
      );
      logger.error('Documentation verification failed', {
        error: (error as Error).message,
      });
    }

    return result;
  }

  private async checkCriticalFiles(
    result: VerificationResult,
  ): Promise<boolean> {
    const criticalFiles = [
      'CLAUDE.md',
      'README.md',
      'Backend/src/services/documentationService.ts',
      'Backend/src/routes/utilities.ts',
      'Frontend/src/components/dashboard/DocumentationDashboard.tsx',
      'Frontend/src/lib/api.ts',
    ];

    let allPresent = true;

    for (const file of criticalFiles) {
      const filePath = join(this.projectRoot, file);
      if (!existsSync(filePath)) {
        result.details.missingFiles.push(file);
        allPresent = false;
      }
    }

    return allPresent;
  }

  private async checkDocumentationSyntax(
    result: VerificationResult,
  ): Promise<boolean> {
    try {
      const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');
      if (!existsSync(claudeMdPath)) {
        return false;
      }

      const content = readFileSync(claudeMdPath, 'utf8');
      const requiredSections = [
        '## Project Overview',
        '## Technology Stack',
        '## Development Commands',
      ];

      let syntaxValid = true;

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          result.details.syntaxErrors.push(`Missing section: ${section}`);
          syntaxValid = false;
        }
      }

      // Check for common documentation issues
      if (!content.includes('version:')) {
        result.details.syntaxErrors.push('Missing version information');
        syntaxValid = false;
      }

      if (content.includes('TODO') || content.includes('FIXME')) {
        result.details.syntaxErrors.push(
          'Documentation contains TODO/FIXME items',
        );
        syntaxValid = false;
      }

      return syntaxValid;
    } catch (error) {
      result.details.syntaxErrors.push(
        `Syntax check failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async checkCompilation(result: VerificationResult): Promise<boolean> {
    try {
      // Check backend compilation
      const backendPath = join(this.projectRoot, 'Backend');

      try {
        execSync('npx tsc --noEmit --skipLibCheck', {
          cwd: backendPath,
          stdio: 'pipe',
        });
      } catch (error: unknown) {
        const execError = error as Error & { stderr?: Buffer };
        const stderrOutput = execError.stderr?.toString();

        result.details.compilationErrors.push(
          `Backend: ${stderrOutput || execError.message}`,
        );
        return false;
      }

      // Check frontend compilation
      const frontendPath = join(this.projectRoot, 'Frontend');

      try {
        execSync('npx tsc --noEmit --skipLibCheck', {
          cwd: frontendPath,
          stdio: 'pipe',
        });
      } catch (error: unknown) {
        const execError = error as Error & { stderr?: Buffer };
        const stderrOutput = execError.stderr?.toString();

        result.details.compilationErrors.push(
          `Frontend: ${stderrOutput || execError.message}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      result.details.compilationErrors.push(
        `Compilation check failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async checkApiEndpoints(
    result: VerificationResult,
  ): Promise<boolean> {
    const baseUrl = (
      process.env.DOCS_VERIFIER_BASE_URL || 'http://localhost:3001'
    ).replace(/\/$/, '');
    const healthUrl = `${baseUrl}/health`;

    try {
      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!healthResponse.ok) {
        result.details.apiErrors.push(
          `Health endpoint returned ${healthResponse.status}`,
        );
        return false;
      }
    } catch (error) {
      result.details.apiErrors.push(
        `Unable to reach API health endpoint: ${(error as Error).message}`,
      );
      return false;
    }

    const username =
      process.env.DOCS_VERIFIER_USERNAME ||
      process.env.ADMIN_USERNAME ||
      'admin';
    const password =
      process.env.DOCS_VERIFIER_PASSWORD ||
      process.env.ADMIN_PASSWORD ||
      'librarian123';

    let token = process.env.DOCS_VERIFIER_TOKEN?.trim();

    if (!token) {
      try {
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(5000),
        });

        const bodyText = await loginResponse.text();
        let payload: unknown = null;
        try {
          payload = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          payload = null;
        }

        const payloadObject =
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : null;

        if (!loginResponse.ok) {
          const payloadMessage =
            payloadObject && typeof payloadObject['message'] === 'string'
              ? (payloadObject['message'] as string)
              : undefined;
          const payloadError =
            payloadObject && typeof payloadObject['error'] === 'string'
              ? (payloadObject['error'] as string)
              : undefined;
          const message =
            payloadMessage ||
            payloadError ||
            loginResponse.statusText ||
            'Login failed';
          result.details.apiErrors.push(
            `Failed to authenticate for documentation check: ${loginResponse.status} ${message}`.trim(),
          );
          return false;
        }

        const payloadData =
          payloadObject &&
          typeof payloadObject['data'] === 'object' &&
          payloadObject['data'] !== null
            ? (payloadObject['data'] as Record<string, unknown>)
            : null;

        const dataToken =
          payloadData && typeof payloadData['token'] === 'string'
            ? (payloadData['token'] as string)
            : undefined;
        const rootToken =
          payloadObject && typeof payloadObject['token'] === 'string'
            ? (payloadObject['token'] as string)
            : undefined;

        token = dataToken || rootToken || undefined;

        if (!token) {
          result.details.apiErrors.push(
            'Authentication succeeded but no token was returned by the API',
          );
          return false;
        }
      } catch (error) {
        result.details.apiErrors.push(
          `Authentication request failed: ${(error as Error).message}`,
        );
        return false;
      }
    }

    if (!token) {
      result.details.apiErrors.push(
        'No authentication token available for documentation check',
      );
      return false;
    }

    const authorizedFetch = async (
      path: string,
      label: string,
    ): Promise<boolean> => {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          result.details.apiErrors.push(`${label} returned ${response.status}`);
          return false;
        }

        return true;
      } catch (error) {
        result.details.apiErrors.push(
          `${label} request failed: ${(error as Error).message}`,
        );
        return false;
      }
    };

    const docsInfoOk = await authorizedFetch(
      '/api/utilities/documentation',
      'Documentation endpoint',
    );
    const docsHealthOk = await authorizedFetch(
      '/api/utilities/documentation/health',
      'Documentation health endpoint',
    );

    return docsInfoOk && docsHealthOk;
  }

  private async checkSynchronization(
    result: VerificationResult,
  ): Promise<boolean> {
    try {
      const docsInfo = await documentationService.getDocumentationInfo();
      let syncHealthy = true;

      // Check if critical documentation files exist according to service
      if (!docsInfo.documentation.claudeMd.exists) {
        result.details.syncIssues.push(
          'CLAUDE.md not detected by documentation service',
        );
        syncHealthy = false;
      }

      if (!docsInfo.documentation.readmeMd.exists) {
        result.details.syncIssues.push(
          'README.md not detected by documentation service',
        );
        syncHealthy = false;
      }

      // Check health status
      if (docsInfo.health.status === 'error') {
        result.details.syncIssues.push(
          'Documentation service reports error status',
        );
        syncHealthy = false;
      }

      // Check if cache is fresh (updated within last hour)
      const lastUpdated = new Date(docsInfo.lastUpdated);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastUpdated < oneHourAgo) {
        result.details.syncIssues.push('Documentation cache is stale');
        syncHealthy = false;
      }

      return syncHealthy;
    } catch (error) {
      result.details.syncIssues.push(
        `Synchronization check failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private generateRecommendations(result: VerificationResult): void {
    if (result.details.missingFiles.length > 0) {
      result.recommendations.push(
        'Create missing critical documentation files',
      );
    }

    if (result.details.syntaxErrors.length > 0) {
      result.recommendations.push(
        'Fix documentation syntax and structure issues',
      );
    }

    if (result.details.compilationErrors.length > 0) {
      result.recommendations.push('Resolve TypeScript compilation errors');
    }

    if (result.details.apiErrors.some(e => !e.includes('Server not running'))) {
      result.recommendations.push('Fix API endpoint issues and restart server');
    }

    if (result.details.syncIssues.length > 0) {
      result.recommendations.push(
        'Run documentation sync: npm run docs:update',
      );
    }

    if (result.recommendations.length === 0) {
      result.recommendations.push('Documentation is in excellent condition!');
    }
  }

  private determineOverallStatus(result: VerificationResult): void {
    const checkValues = Object.values(result.checks);
    const passedChecks = checkValues.filter(Boolean).length;

    if (passedChecks === checkValues.length) {
      result.overall = 'healthy';
    } else if (passedChecks >= checkValues.length * 0.6) {
      result.overall = 'warning';
    } else {
      result.overall = 'error';
    }

    result.success = result.overall !== 'error';
  }

  async fixDocumentation(): Promise<boolean> {
    try {
      logger.info('Attempting to fix documentation issues...');

      // Run documentation update script
      const { DocumentationUpdater } = await import('./updateDocumentation');
      const updater = new DocumentationUpdater();

      const result = await updater.updateAllDocumentation();

      if (result.success) {
        logger.info('Documentation issues fixed successfully');
        return true;
      } else {
        logger.error('Failed to fix documentation issues', {
          message: result.message,
        });
        return false;
      }
    } catch (error) {
      logger.error('Documentation fix attempt failed', {
        error: (error as Error).message,
      });
      return false;
    }
  }
}

// CLI execution
async function main() {
  const verifier = new DocumentationVerifier();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'check':
        const result = await verifier.verifyAll();
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
          console.log('\n✅ Documentation verification passed!');
          process.exit(0);
        } else {
          console.log('\n❌ Documentation verification failed!');
          process.exit(1);
        }

      case 'fix':
        console.log('Attempting to fix documentation issues...');
        const fixed = await verifier.fixDocumentation();

        if (fixed) {
          console.log('✅ Documentation issues fixed successfully');
          process.exit(0);
        } else {
          console.log('❌ Failed to fix documentation issues');
          process.exit(1);
        }

      default:
        console.log('Usage:');
        console.log(
          '  ts-node verifyDocumentation.ts check - Verify documentation health',
        );
        console.log(
          '  ts-node verifyDocumentation.ts fix   - Attempt to fix documentation issues',
        );
        break;
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

// Export for programmatic use
export { DocumentationVerifier, VerificationResult };

// Run if called directly
if (require.main === module) {
  main();
}
