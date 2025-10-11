#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationVerifier = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const documentationService_1 = require("../services/documentationService");
const logger_1 = require("../utils/logger");
class DocumentationVerifier {
    projectRoot;
    constructor() {
        this.projectRoot = (0, path_1.join)(__dirname, '..', '..');
    }
    async verifyAll() {
        const result = {
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
            logger_1.logger.info('Starting comprehensive documentation verification...');
            result.checks.criticalFiles = await this.checkCriticalFiles(result);
            result.checks.syntax = await this.checkDocumentationSyntax(result);
            result.checks.compilation = await this.checkCompilation(result);
            result.checks.api = await this.checkApiEndpoints(result);
            result.checks.sync = await this.checkSynchronization(result);
            this.generateRecommendations(result);
            this.determineOverallStatus(result);
            logger_1.logger.info(`Documentation verification completed: ${result.overall.toUpperCase()}`);
        }
        catch (error) {
            result.success = false;
            result.overall = 'error';
            result.details.syncIssues.push(`Verification failed: ${error.message}`);
            logger_1.logger.error('Documentation verification failed', {
                error: error.message,
            });
        }
        return result;
    }
    async checkCriticalFiles(result) {
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
            const filePath = (0, path_1.join)(this.projectRoot, file);
            if (!(0, fs_1.existsSync)(filePath)) {
                result.details.missingFiles.push(file);
                allPresent = false;
            }
        }
        return allPresent;
    }
    async checkDocumentationSyntax(result) {
        try {
            const claudeMdPath = (0, path_1.join)(this.projectRoot, 'CLAUDE.md');
            if (!(0, fs_1.existsSync)(claudeMdPath)) {
                return false;
            }
            const content = (0, fs_1.readFileSync)(claudeMdPath, 'utf8');
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
            if (!content.includes('version:')) {
                result.details.syntaxErrors.push('Missing version information');
                syntaxValid = false;
            }
            if (content.includes('TODO') || content.includes('FIXME')) {
                result.details.syntaxErrors.push('Documentation contains TODO/FIXME items');
                syntaxValid = false;
            }
            return syntaxValid;
        }
        catch (error) {
            result.details.syntaxErrors.push(`Syntax check failed: ${error.message}`);
            return false;
        }
    }
    async checkCompilation(result) {
        try {
            const backendPath = (0, path_1.join)(this.projectRoot, 'Backend');
            try {
                (0, child_process_1.execSync)('npx tsc --noEmit --skipLibCheck', {
                    cwd: backendPath,
                    stdio: 'pipe',
                });
            }
            catch (error) {
                const execError = error;
                const stderrOutput = execError.stderr?.toString();
                result.details.compilationErrors.push(`Backend: ${stderrOutput || execError.message}`);
                return false;
            }
            const frontendPath = (0, path_1.join)(this.projectRoot, 'Frontend');
            try {
                (0, child_process_1.execSync)('npx tsc --noEmit --skipLibCheck', {
                    cwd: frontendPath,
                    stdio: 'pipe',
                });
            }
            catch (error) {
                const execError = error;
                const stderrOutput = execError.stderr?.toString();
                result.details.compilationErrors.push(`Frontend: ${stderrOutput || execError.message}`);
                return false;
            }
            return true;
        }
        catch (error) {
            result.details.compilationErrors.push(`Compilation check failed: ${error.message}`);
            return false;
        }
    }
    async checkApiEndpoints(result) {
        try {
            const response = await fetch('http://localhost:3001/api/utilities/documentation', {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                result.details.apiErrors.push(`Documentation endpoint returned ${response.status}`);
                return false;
            }
            const healthResponse = await fetch('http://localhost:3001/api/utilities/documentation/health', {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (!healthResponse.ok) {
                result.details.apiErrors.push(`Health endpoint returned ${healthResponse.status}`);
                return false;
            }
            return true;
        }
        catch (_error) {
            result.details.apiErrors.push('Server not running - API endpoints not verified');
            return false;
        }
    }
    async checkSynchronization(result) {
        try {
            const docsInfo = await documentationService_1.documentationService.getDocumentationInfo();
            let syncHealthy = true;
            if (!docsInfo.documentation.claudeMd.exists) {
                result.details.syncIssues.push('CLAUDE.md not detected by documentation service');
                syncHealthy = false;
            }
            if (!docsInfo.documentation.readmeMd.exists) {
                result.details.syncIssues.push('README.md not detected by documentation service');
                syncHealthy = false;
            }
            if (docsInfo.health.status === 'error') {
                result.details.syncIssues.push('Documentation service reports error status');
                syncHealthy = false;
            }
            const lastUpdated = new Date(docsInfo.lastUpdated);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            if (lastUpdated < oneHourAgo) {
                result.details.syncIssues.push('Documentation cache is stale');
                syncHealthy = false;
            }
            return syncHealthy;
        }
        catch (error) {
            result.details.syncIssues.push(`Synchronization check failed: ${error.message}`);
            return false;
        }
    }
    generateRecommendations(result) {
        if (result.details.missingFiles.length > 0) {
            result.recommendations.push('Create missing critical documentation files');
        }
        if (result.details.syntaxErrors.length > 0) {
            result.recommendations.push('Fix documentation syntax and structure issues');
        }
        if (result.details.compilationErrors.length > 0) {
            result.recommendations.push('Resolve TypeScript compilation errors');
        }
        if (result.details.apiErrors.some(e => !e.includes('Server not running'))) {
            result.recommendations.push('Fix API endpoint issues and restart server');
        }
        if (result.details.syncIssues.length > 0) {
            result.recommendations.push('Run documentation sync: npm run docs:update');
        }
        if (result.recommendations.length === 0) {
            result.recommendations.push('Documentation is in excellent condition!');
        }
    }
    determineOverallStatus(result) {
        const checkValues = Object.values(result.checks);
        const passedChecks = checkValues.filter(Boolean).length;
        if (passedChecks === checkValues.length) {
            result.overall = 'healthy';
        }
        else if (passedChecks >= checkValues.length * 0.6) {
            result.overall = 'warning';
        }
        else {
            result.overall = 'error';
        }
        result.success = result.overall !== 'error';
    }
    async fixDocumentation() {
        try {
            logger_1.logger.info('Attempting to fix documentation issues...');
            const { DocumentationUpdater } = await Promise.resolve().then(() => __importStar(require('./updateDocumentation')));
            const updater = new DocumentationUpdater();
            const result = await updater.updateAllDocumentation();
            if (result.success) {
                logger_1.logger.info('Documentation issues fixed successfully');
                return true;
            }
            else {
                logger_1.logger.error('Failed to fix documentation issues', {
                    message: result.message,
                });
                return false;
            }
        }
        catch (error) {
            logger_1.logger.error('Documentation fix attempt failed', {
                error: error.message,
            });
            return false;
        }
    }
}
exports.DocumentationVerifier = DocumentationVerifier;
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
                }
                else {
                    console.log('\n❌ Documentation verification failed!');
                    process.exit(1);
                }
            case 'fix':
                console.log('Attempting to fix documentation issues...');
                const fixed = await verifier.fixDocumentation();
                if (fixed) {
                    console.log('✅ Documentation issues fixed successfully');
                    process.exit(0);
                }
                else {
                    console.log('❌ Failed to fix documentation issues');
                    process.exit(1);
                }
            default:
                console.log('Usage:');
                console.log('  ts-node verifyDocumentation.ts check - Verify documentation health');
                console.log('  ts-node verifyDocumentation.ts fix   - Attempt to fix documentation issues');
                break;
        }
    }
    catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=verifyDocumentation.js.map