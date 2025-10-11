#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationUpdater = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const documentationService_1 = require("../services/documentationService");
const logger_1 = require("../utils/logger");
class DocumentationUpdater {
    projectRoot;
    constructor() {
        this.projectRoot = (0, path_1.join)(__dirname, '..', '..');
    }
    async updateAllDocumentation() {
        const result = {
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
            logger_1.logger.info('Starting automated documentation update...');
            result.updates.version = await this.updateVersionInfo();
            result.updates.features = await this.updateFeatureCounts();
            result.updates.health = await this.updateHealthStatus();
            result.updates.files = await this.updateFileDocumentation();
            await documentationService_1.documentationService.refreshCache();
            const updateCount = Object.values(result.updates).filter(Boolean).length;
            result.message = `Successfully updated ${updateCount} documentation sections`;
            logger_1.logger.info(`Documentation update completed: ${result.message}`);
        }
        catch (error) {
            result.success = false;
            result.message = `Documentation update failed: ${error.message}`;
            logger_1.logger.error('Documentation update failed', {
                error: error.message,
            });
        }
        return result;
    }
    async updateVersionInfo() {
        try {
            const packageJsonPath = (0, path_1.join)(this.projectRoot, 'Backend', 'package.json');
            const claudeMdPath = (0, path_1.join)(this.projectRoot, 'CLAUDE.md');
            if (!(0, fs_1.existsSync)(packageJsonPath) || !(0, fs_1.existsSync)(claudeMdPath)) {
                logger_1.logger.warn('Required files for version update not found');
                return false;
            }
            const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
            const claudeMd = (0, fs_1.readFileSync)(claudeMdPath, 'utf8');
            const currentVersion = packageJson.version || '1.0.0';
            const versionRegex = /version:\s*[\d.]+/i;
            const newVersionLine = `version: ${currentVersion}`;
            if (!versionRegex.test(claudeMd) || !claudeMd.includes(currentVersion)) {
                const updatedClaudeMd = claudeMd.replace(versionRegex, newVersionLine);
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
                logger_1.logger.info(`Updated version to ${currentVersion} in CLAUDE.md`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Failed to update version info', {
                error: error.message,
            });
            return false;
        }
    }
    async updateFeatureCounts() {
        try {
            const docsInfo = await documentationService_1.documentationService.getDocumentationInfo();
            const claudeMdPath = (0, path_1.join)(this.projectRoot, 'CLAUDE.md');
            if (!(0, fs_1.existsSync)(claudeMdPath)) {
                return false;
            }
            const claudeMd = (0, fs_1.readFileSync)(claudeMdPath, 'utf8');
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
            const featuresRegex = /## Feature Statistics[\s\S]*?(?=##|$)/;
            if (featuresRegex.test(claudeMd)) {
                const updatedClaudeMd = claudeMd.replace(featuresRegex, featuresSection.trim());
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            else {
                const overviewRegex = /(## Project Overview[\s\S]*?)(?=##|$)/;
                const updatedClaudeMd = claudeMd.replace(overviewRegex, `$1\n\n${featuresSection.trim()}\n`);
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            logger_1.logger.info('Updated feature counts in CLAUDE.md');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to update feature counts', {
                error: error.message,
            });
            return false;
        }
    }
    async updateHealthStatus() {
        try {
            const docsInfo = await documentationService_1.documentationService.getDocumentationInfo();
            const claudeMdPath = (0, path_1.join)(this.projectRoot, 'CLAUDE.md');
            if (!(0, fs_1.existsSync)(claudeMdPath)) {
                return false;
            }
            const claudeMd = (0, fs_1.readFileSync)(claudeMdPath, 'utf8');
            const healthStatus = `
## System Health Status

**Overall Status**: ${docsInfo.health.status.toUpperCase()}

- **Documentation Files**: ${docsInfo.health.checks.documentation ? '✅ Healthy' : '❌ Issues found'}
- **Test Status**: ${docsInfo.health.checks.tests ? '✅ Healthy' : '❌ Issues found'}
- **Build Status**: ${docsInfo.health.checks.builds ? '✅ Healthy' : '❌ Issues found'}

*Last checked: ${new Date().toLocaleDateString()}*
`;
            const healthRegex = /## System Health Status[\s\S]*?(?=##|$)/;
            if (healthRegex.test(claudeMd)) {
                const updatedClaudeMd = claudeMd.replace(healthRegex, healthStatus.trim());
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            else {
                const featuresRegex = /(## Feature Statistics[\s\S]*?)(?=##|$)/;
                const updatedClaudeMd = claudeMd.replace(featuresRegex, `$1\n\n${healthStatus.trim()}\n`);
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            logger_1.logger.info('Updated health status in CLAUDE.md');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to update health status', {
                error: error.message,
            });
            return false;
        }
    }
    async updateFileDocumentation() {
        try {
            const docsInfo = await documentationService_1.documentationService.getDocumentationInfo();
            const claudeMdPath = (0, path_1.join)(this.projectRoot, 'CLAUDE.md');
            if (!(0, fs_1.existsSync)(claudeMdPath)) {
                return false;
            }
            const claudeMd = (0, fs_1.readFileSync)(claudeMdPath, 'utf8');
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
            const fileDocsRegex = /## Documentation Files Status[\s\S]*?(?=##|$)/;
            if (fileDocsRegex.test(claudeMd)) {
                const updatedClaudeMd = claudeMd.replace(fileDocsRegex, fileDocs.trim());
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            else {
                const healthRegex = /(## System Health Status[\s\S]*?)(?=##|$)/;
                const updatedClaudeMd = claudeMd.replace(healthRegex, `$1\n\n${fileDocs.trim()}\n`);
                (0, fs_1.writeFileSync)(claudeMdPath, updatedClaudeMd);
            }
            logger_1.logger.info('Updated file documentation in CLAUDE.md');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to update file documentation', {
                error: error.message,
            });
            return false;
        }
    }
    async checkAndFixDocumentation() {
        try {
            const docsInfo = await documentationService_1.documentationService.getDocumentationInfo();
            let fixed = false;
            const criticalFiles = [
                { path: 'CLAUDE.md', template: this.getClaudeMdTemplate() },
                { path: 'README.md', template: this.getReadmeTemplate() },
            ];
            for (const file of criticalFiles) {
                const filePath = (0, path_1.join)(this.projectRoot, file.path);
                if (!(0, fs_1.existsSync)(filePath)) {
                    (0, fs_1.writeFileSync)(filePath, file.template);
                    logger_1.logger.info(`Created missing file: ${file.path}`);
                    fixed = true;
                }
            }
            if (!docsInfo.documentation.claudeMd.exists ||
                !docsInfo.documentation.readmeMd.exists) {
                logger_1.logger.warn('Critical documentation files are missing');
                fixed = true;
            }
            return fixed;
        }
        catch (error) {
            logger_1.logger.error('Failed to check and fix documentation', {
                error: error.message,
            });
            return false;
        }
    }
    getClaudeMdTemplate() {
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
    getReadmeTemplate() {
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
exports.DocumentationUpdater = DocumentationUpdater;
async function main() {
    const updater = new DocumentationUpdater();
    try {
        await updater.checkAndFixDocumentation();
        const result = await updater.updateAllDocumentation();
        console.log(JSON.stringify(result, null, 2));
        if (result.success) {
            process.exit(0);
        }
        else {
            process.exit(1);
        }
    }
    catch (error) {
        logger_1.logger.error('Documentation update script failed', {
            error: error.message,
        });
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=updateDocumentation.js.map