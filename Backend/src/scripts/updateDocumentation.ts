#!/usr/bin/env ts-node

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { documentationService } from '../services/documentationService';
import { logger } from '../utils/logger';

interface DocumentationUpdateResult {
  success: boolean;
  message: string;
  updates: {
    version: boolean;
    features: boolean;
    health: boolean;
    files: boolean;
  };
  timestamp: string;
}

class DocumentationUpdater {
  private projectRoot: string;

  constructor() {
    this.projectRoot = join(__dirname, '..', '..');
  }

  async updateAllDocumentation(): Promise<DocumentationUpdateResult> {
    const result: DocumentationUpdateResult = {
      success: true,
      message: '',
      updates: {
        version: false,
        features: false,
        health: false,
        files: false,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      logger.info('Starting automated documentation update...');

      // 1. Update version information
      result.updates.version = await this.updateVersionInfo();

      // 2. Update feature counts
      result.updates.features = await this.updateFeatureCounts();

      // 3. Update health status
      result.updates.health = await this.updateHealthStatus();

      // 4. Update file documentation
      result.updates.files = await this.updateFileDocumentation();

      // 5. Refresh documentation service cache
      await documentationService.refreshCache();

      const updateCount = Object.values(result.updates).filter(Boolean).length;
      result.message = `Successfully updated ${updateCount} documentation sections`;

      logger.info(`Documentation update completed: ${result.message}`);
    } catch (error) {
      result.success = false;
      result.message = `Documentation update failed: ${(error as Error).message}`;
      logger.error('Documentation update failed', {
        error: (error as Error).message,
      });
    }

    return result;
  }

  private async updateVersionInfo(): Promise<boolean> {
    try {
      const packageJsonPath = join(this.projectRoot, 'Backend', 'package.json');
      const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');

      if (!existsSync(packageJsonPath) || !existsSync(claudeMdPath)) {
        logger.warn('Required files for version update not found');
        return false;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const claudeMd = readFileSync(claudeMdPath, 'utf8');

      const currentVersion = packageJson.version || '1.0.0';

      // Update version in CLAUDE.md if different
      const versionRegex = /version:\s*[\d.]+/i;
      const newVersionLine = `version: ${currentVersion}`;

      if (!versionRegex.test(claudeMd) || !claudeMd.includes(currentVersion)) {
        const updatedClaudeMd = claudeMd.replace(versionRegex, newVersionLine);

        writeFileSync(claudeMdPath, updatedClaudeMd);
        logger.info(`Updated version to ${currentVersion} in CLAUDE.md`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to update version info', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private async updateFeatureCounts(): Promise<boolean> {
    try {
      const docsInfo = await documentationService.getDocumentationInfo();
      const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');

      if (!existsSync(claudeMdPath)) {
        return false;
      }

      const claudeMd = readFileSync(claudeMdPath, 'utf8');

      // Update feature counts in documentation
      const featuresSection = `
## Feature Statistics

- **Backend Tests**: ${docsInfo.features.backend.tests}
- **Frontend Tests**: ${docsInfo.features.frontend.tests}
- **API Endpoints**: ${docsInfo.features.backend.apiEndpoints}
- **Services**: ${docsInfo.features.backend.services}
- **Database Tables**: ${docsInfo.features.backend.databaseTables}
- **Frontend Components**: ${docsInfo.features.frontend.components}
- **Pages**: ${docsInfo.features.frontend.pages}

*Last updated: ${new Date().toLocaleDateString()}*
`;

      // Check if features section exists and update it
      const featuresRegex = /## Feature Statistics[\s\S]*?(?=##|$)/;

      if (featuresRegex.test(claudeMd)) {
        const updatedClaudeMd = claudeMd.replace(
          featuresRegex,
          featuresSection.trim(),
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      } else {
        // Add features section after project overview
        const overviewRegex = /(## Project Overview[\s\S]*?)(?=##|$)/;
        const updatedClaudeMd = claudeMd.replace(
          overviewRegex,
          `$1\n\n${featuresSection.trim()}\n`,
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      }

      logger.info('Updated feature counts in CLAUDE.md');
      return true;
    } catch (error) {
      logger.error('Failed to update feature counts', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private async updateHealthStatus(): Promise<boolean> {
    try {
      const docsInfo = await documentationService.getDocumentationInfo();
      const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');

      if (!existsSync(claudeMdPath)) {
        return false;
      }

      const claudeMd = readFileSync(claudeMdPath, 'utf8');

      // Create health status section
      const healthStatus = `
## System Health Status

**Overall Status**: ${docsInfo.health.status.toUpperCase()}

- **Documentation Files**: ${docsInfo.health.checks.documentation ? '✅ Healthy' : '❌ Issues found'}
- **Test Status**: ${docsInfo.health.checks.tests ? '✅ Healthy' : '❌ Issues found'}
- **Build Status**: ${docsInfo.health.checks.builds ? '✅ Healthy' : '❌ Issues found'}

*Last checked: ${new Date().toLocaleDateString()}*
`;

      // Update or add health status section
      const healthRegex = /## System Health Status[\s\S]*?(?=##|$)/;

      if (healthRegex.test(claudeMd)) {
        const updatedClaudeMd = claudeMd.replace(
          healthRegex,
          healthStatus.trim(),
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      } else {
        // Add health status section after features
        const featuresRegex = /(## Feature Statistics[\s\S]*?)(?=##|$)/;
        const updatedClaudeMd = claudeMd.replace(
          featuresRegex,
          `$1\n\n${healthStatus.trim()}\n`,
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      }

      logger.info('Updated health status in CLAUDE.md');
      return true;
    } catch (error) {
      logger.error('Failed to update health status', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private async updateFileDocumentation(): Promise<boolean> {
    try {
      const docsInfo = await documentationService.getDocumentationInfo();
      const claudeMdPath = join(this.projectRoot, 'CLAUDE.md');

      if (!existsSync(claudeMdPath)) {
        return false;
      }

      const claudeMd = readFileSync(claudeMdPath, 'utf8');

      // Create file documentation section
      const fileDocs = `
## Documentation Files Status

- **CLAUDE.md**: ${docsInfo.documentation.claudeMd.exists ? '✅ Present' : '❌ Missing'}
  - Last Modified: ${docsInfo.documentation.claudeMd.lastModified ? new Date(docsInfo.documentation.claudeMd.lastModified).toLocaleDateString() : 'N/A'}
- **README.md**: ${docsInfo.documentation.readmeMd.exists ? '✅ Present' : '❌ Missing'}
  - Last Modified: ${docsInfo.documentation.readmeMd.lastModified ? new Date(docsInfo.documentation.readmeMd.lastModified).toLocaleDateString() : 'N/A'}
- **API Documentation**: ${docsInfo.documentation.apiDocs.exists ? '✅ Present' : '⚠️ Optional'}
  - Last Modified: ${docsInfo.documentation.apiDocs.lastModified ? new Date(docsInfo.documentation.apiDocs.lastModified).toLocaleDateString() : 'N/A'}

*Last updated: ${new Date().toLocaleDateString()}*
`;

      // Update or add file documentation section
      const fileDocsRegex = /## Documentation Files Status[\s\S]*?(?=##|$)/;

      if (fileDocsRegex.test(claudeMd)) {
        const updatedClaudeMd = claudeMd.replace(
          fileDocsRegex,
          fileDocs.trim(),
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      } else {
        // Add file documentation section after health status
        const healthRegex = /(## System Health Status[\s\S]*?)(?=##|$)/;
        const updatedClaudeMd = claudeMd.replace(
          healthRegex,
          `$1\n\n${fileDocs.trim()}\n`,
        );
        writeFileSync(claudeMdPath, updatedClaudeMd);
      }

      logger.info('Updated file documentation in CLAUDE.md');
      return true;
    } catch (error) {
      logger.error('Failed to update file documentation', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  async checkAndFixDocumentation(): Promise<boolean> {
    try {
      const docsInfo = await documentationService.getDocumentationInfo();
      let fixed = false;

      // Check for missing critical files and create basic versions
      const criticalFiles = [
        { path: 'CLAUDE.md', template: this.getClaudeMdTemplate() },
        { path: 'README.md', template: this.getReadmeTemplate() },
      ];

      for (const file of criticalFiles) {
        const filePath = join(this.projectRoot, file.path);
        if (!existsSync(filePath)) {
          writeFileSync(filePath, file.template);
          logger.info(`Created missing file: ${file.path}`);
          fixed = true;
        }
      }

      // Check for broken documentation structure
      if (
        !docsInfo.documentation.claudeMd.exists ||
        !docsInfo.documentation.readmeMd.exists
      ) {
        logger.warn('Critical documentation files are missing');
        fixed = true;
      }

      return fixed;
    } catch (error) {
      logger.error('Failed to check and fix documentation', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  private getClaudeMdTemplate(): string {
    return `# CLAUDE.md

This file provides guidance for Claude Code when working with the CLMS codebase.

## Project Overview

CLMS (Comprehensive Library Management System) is a local web application for school library management.

## Technology Stack

- **Frontend:** React 18.3.1 with TypeScript
- **Backend:** Node.js 20+ with Express.js
- **Database:** MySQL 8.0 with Prisma ORM
- **Cache:** Redis 7 for job queues and caching
- **Testing:** Vitest for both frontend and backend

## Development Commands

\`\`\`bash
# Backend
cd Backend
npm install
npm run dev
npm test

# Frontend
cd Frontend
npm install
npm run dev
npm test

# Database
npm run db:generate
npm run db:push
\`\`\`

*This file was automatically generated on ${new Date().toLocaleDateString()}*
`;
  }

  private getReadmeTemplate(): string {
    return `# CLMS - Comprehensive Library Management System

A modern library management system for schools.

## Features

- Student management and activity tracking
- Equipment checkout system
- Automated reporting with Google Sheets integration
- Real-time dashboard and analytics

## Quick Start

1. Clone the repository
2. Install dependencies: \`npm install\` in both Backend/ and Frontend/
3. Set up MySQL database
4. Run \`npm run db:push\` in Backend/
5. Start development servers:
   - Backend: \`npm run dev\` (port 3001)
   - Frontend: \`npm run dev\` (port 3000)

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed development documentation.

*This file was automatically generated on ${new Date().toLocaleDateString()}*
`;
  }
}

// CLI execution
async function main() {
  const updater = new DocumentationUpdater();

  try {
    // Check and fix missing documentation first
    await updater.checkAndFixDocumentation();

    // Update all documentation
    const result = await updater.updateAllDocumentation();

    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Documentation update script failed', {
      error: (error as Error).message,
    });
    process.exit(1);
  }
}

// Export for programmatic use
export { DocumentationUpdater, DocumentationUpdateResult };

// Run if called directly
if (require.main === module) {
  main();
}
