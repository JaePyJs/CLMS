import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '@/utils/logger';

export interface DocumentationInfo {
  version: string;
  lastUpdated: string;
  lastCommitHash?: string;
  environment: string;
  features: {
    backend: {
      tests: number;
      apiEndpoints: number;
      services: number;
      databaseTables: number;
    };
    frontend: {
      tests: number;
      components: number;
      pages: number;
      assets: number;
    };
  };
  documentation: {
    claudeMd: {
      exists: boolean;
      lastModified: string;
      sections: number;
    };
    readmeMd: {
      exists: boolean;
      lastModified: string;
    };
    apiDocs: {
      exists: boolean;
      lastModified: string;
    };
  };
  health: {
    status: 'healthy' | 'warning' | 'error';
    checks: {
      documentation: boolean;
      tests: boolean;
      builds: boolean;
    };
  };
}

class DocumentationService {
  private static instance: DocumentationService;
  private cache: DocumentationInfo | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): DocumentationService {
    if (!DocumentationService.instance) {
      DocumentationService.instance = new DocumentationService();
    }
    return DocumentationService.instance;
  }

  async getDocumentationInfo(): Promise<DocumentationInfo> {
    const now = Date.now();

    // Return cached info if still valid
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const info = await this.buildDocumentationInfo();
      this.cache = info;
      this.cacheExpiry = now + this.CACHE_DURATION;
      return info;
    } catch (error) {
      logger.error('Failed to build documentation info', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async buildDocumentationInfo(): Promise<DocumentationInfo> {
    const projectRoot = this.getProjectRoot();

    return {
      version: await this.getVersion(),
      lastUpdated: new Date().toISOString(),
      lastCommitHash: await this.getLastCommitHash(),
      environment: process.env.NODE_ENV || 'development',
      features: {
        backend: await this.getBackendFeatures(),
        frontend: await this.getFrontendFeatures(),
      },
      documentation: {
        claudeMd: await this.getFileInfo('CLAUDE.md', projectRoot, {
          countSections: true,
        }),
        readmeMd: await this.getFileInfo('README.md', projectRoot),
        apiDocs: await this.getFileInfo(
          'Docs/API_DOCUMENTATION.md',
          projectRoot,
        ),
      },
      health: await this.getHealthStatus(),
    };
  }

  private async getVersion(): Promise<string> {
    try {
      // Try to get version from package.json
      const packageJsonPath = join(
        this.getProjectRoot(),
        'Backend',
        'package.json',
      );
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version || '1.0.0';
      }
    } catch (error) {
      logger.warn('Could not read version from package.json', {
        error: (error as Error).message,
      });
    }

    return process.env.APP_VERSION || '1.0.0';
  }

  private async getLastCommitHash(): Promise<string | undefined> {
    try {
      const { execSync } = require('child_process');
      const hash = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        cwd: this.getProjectRoot(),
      }).trim();
      return hash.substring(0, 8); // Short hash
    } catch (error) {
      logger.warn('Could not get git commit hash', {
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  private async getBackendFeatures() {
    const backendPath = join(this.getProjectRoot(), 'Backend', 'src');

    return {
      tests: await this.countFiles('**/*.test.ts', backendPath),
      apiEndpoints: await this.countFiles('routes/*.ts', backendPath),
      services: await this.countFiles('services/*.ts', backendPath),
      databaseTables: await this.countDatabaseTables(),
    };
  }

  private async getFrontendFeatures() {
    const frontendPath = join(this.getProjectRoot(), 'Frontend', 'src');

    return {
      tests: await this.countFiles('**/*.test.ts*', frontendPath),
      components: await this.countFiles('components/**/*.tsx', frontendPath),
      pages: await this.countFiles('pages/**/*.tsx', frontendPath),
      assets: await this.countFiles('assets/**/*', frontendPath),
    };
  }

  private async countFiles(pattern: string, basePath: string): Promise<number> {
    try {
      const { glob } = require('glob');
      const files = glob.sync(pattern, { cwd: basePath });
      return files.length;
    } catch (error) {
      logger.warn(`Could not count files for pattern ${pattern}`, {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  private async countDatabaseTables(): Promise<number> {
    try {
      const { prisma } = await import('@/utils/prisma');
      const result = await prisma.$queryRaw<
        Array<{ count: bigint | number }>
      >`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()`;
      const row = result[0];
      if (!row) {
        return 0;
      }
      return typeof row.count === 'bigint' ? Number(row.count) : row.count;
    } catch (error) {
      logger.warn('Could not count database tables', {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  private async getFileInfo(
    filename: string,
    basePath: string,
    options: { countSections: true },
  ): Promise<{ exists: boolean; lastModified: string; sections: number }>;

  private async getFileInfo(
    filename: string,
    basePath: string,
    options?: { countSections?: false },
  ): Promise<{ exists: boolean; lastModified: string }>;

  private async getFileInfo(
    filename: string,
    basePath: string,
    options?: { countSections?: boolean },
  ) {
    const filePath = join(basePath, filename);

    if (!existsSync(filePath)) {
      if (options?.countSections) {
        return {
          exists: false,
          lastModified: '',
          sections: 0,
        };
      }

      return {
        exists: false,
        lastModified: '',
      };
    }

    const stats = statSync(filePath);
    let sections = 0;

    if (options?.countSections) {
      try {
        const content = readFileSync(filePath, 'utf8');
        sections = (content.match(/^##\s+/gm) || []).length;
      } catch (error) {
        logger.warn('Could not read file for section count', {
          error: (error as Error).message,
          filePath,
        });
      }
    }

    if (options?.countSections) {
      return {
        exists: true,
        lastModified: stats.mtime.toISOString(),
        sections,
      };
    }

    return {
      exists: true,
      lastModified: stats.mtime.toISOString(),
    };
  }

  private async getHealthStatus() {
    const checks = await Promise.all([
      this.checkDocumentation(),
      this.checkTests(),
      this.checkBuilds(),
    ]);

    const [documentation, tests, builds] = checks;

    const allHealthy = documentation && tests && builds;
    const someWarning =
      [documentation, tests, builds].filter(Boolean).length >= 2;

    const status: 'healthy' | 'warning' | 'error' = allHealthy
      ? 'healthy'
      : someWarning
        ? 'warning'
        : 'error';

    return {
      status,
      checks: {
        documentation,
        tests,
        builds,
      },
    };
  }

  private async checkDocumentation(): Promise<boolean> {
    const projectRoot = this.getProjectRoot();
    const criticalFiles = ['CLAUDE.md', 'README.md'];

    for (const file of criticalFiles) {
      if (!existsSync(join(projectRoot, file))) {
        return false;
      }
    }

    return true;
  }

  private async checkTests(): Promise<boolean> {
    try {
      // Check if tests have been run recently (within last 24 hours)
      const backendPath = join(this.getProjectRoot(), 'Backend');
      const testResultsPath = join(backendPath, 'test-results.json');

      if (existsSync(testResultsPath)) {
        const stats = statSync(testResultsPath);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return stats.mtime.getTime() > oneDayAgo;
      }

      // Fall back to checking if test files exist
      const backendTestFiles = await this.countFiles(
        '**/*.test.ts',
        join(backendPath, 'src'),
      );
      const frontendTestFiles = await this.countFiles(
        '**/*.test.ts*',
        join(this.getProjectRoot(), 'Frontend', 'src'),
      );

      return backendTestFiles > 0 && frontendTestFiles > 0;
    } catch (error) {
      logger.warn('Could not check test status', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private async checkBuilds(): Promise<boolean> {
    try {
      const backendPath = join(this.getProjectRoot(), 'Backend', 'dist');
      const frontendPath = join(this.getProjectRoot(), 'Frontend', 'dist');

      return existsSync(backendPath) && existsSync(frontendPath);
    } catch (error) {
      logger.warn('Could not check build status', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private getProjectRoot(): string {
    // Go up from Backend/src to project root
    return join(__dirname, '..', '..');
  }

  async refreshCache(): Promise<void> {
    this.cache = null;
    this.cacheExpiry = 0;
    await this.getDocumentationInfo();
  }
}

export const documentationService = DocumentationService.getInstance();
export default documentationService;
