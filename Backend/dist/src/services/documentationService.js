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
exports.documentationService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("@/utils/logger");
class DocumentationService {
    static instance;
    cache = null;
    cacheExpiry = 0;
    CACHE_DURATION = 5 * 60 * 1000;
    constructor() { }
    static getInstance() {
        if (!DocumentationService.instance) {
            DocumentationService.instance = new DocumentationService();
        }
        return DocumentationService.instance;
    }
    async getDocumentationInfo() {
        const now = Date.now();
        if (this.cache && now < this.cacheExpiry) {
            return this.cache;
        }
        try {
            const info = await this.buildDocumentationInfo();
            this.cache = info;
            this.cacheExpiry = now + this.CACHE_DURATION;
            return info;
        }
        catch (error) {
            logger_1.logger.error('Failed to build documentation info', {
                error: error.message,
            });
            throw error;
        }
    }
    async buildDocumentationInfo() {
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
                apiDocs: await this.getFileInfo('Docs/API_DOCUMENTATION.md', projectRoot),
            },
            health: await this.getHealthStatus(),
        };
    }
    async getVersion() {
        try {
            const packageJsonPath = (0, path_1.join)(this.getProjectRoot(), 'Backend', 'package.json');
            if ((0, fs_1.existsSync)(packageJsonPath)) {
                const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
                return packageJson.version || '1.0.0';
            }
        }
        catch (error) {
            logger_1.logger.warn('Could not read version from package.json', {
                error: error.message,
            });
        }
        return process.env.APP_VERSION || '1.0.0';
    }
    async getLastCommitHash() {
        try {
            const { execSync } = require('child_process');
            const hash = execSync('git rev-parse HEAD', {
                encoding: 'utf8',
                cwd: this.getProjectRoot(),
            }).trim();
            return hash.substring(0, 8);
        }
        catch (error) {
            logger_1.logger.warn('Could not get git commit hash', {
                error: error.message,
            });
            return undefined;
        }
    }
    async getBackendFeatures() {
        const backendPath = (0, path_1.join)(this.getProjectRoot(), 'Backend', 'src');
        return {
            tests: await this.countFiles('**/*.test.ts', backendPath),
            apiEndpoints: await this.countFiles('routes/*.ts', backendPath),
            services: await this.countFiles('services/*.ts', backendPath),
            databaseTables: await this.countDatabaseTables(),
        };
    }
    async getFrontendFeatures() {
        const frontendPath = (0, path_1.join)(this.getProjectRoot(), 'Frontend', 'src');
        return {
            tests: await this.countFiles('**/*.test.ts*', frontendPath),
            components: await this.countFiles('components/**/*.tsx', frontendPath),
            pages: await this.countFiles('pages/**/*.tsx', frontendPath),
            assets: await this.countFiles('assets/**/*', frontendPath),
        };
    }
    async countFiles(pattern, basePath) {
        try {
            const { glob } = require('glob');
            const files = glob.sync(pattern, { cwd: basePath });
            return files.length;
        }
        catch (error) {
            logger_1.logger.warn(`Could not count files for pattern ${pattern}`, {
                error: error.message,
            });
            return 0;
        }
    }
    async countDatabaseTables() {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@/utils/prisma')));
            const result = await prisma.$queryRaw `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()`;
            const row = result[0];
            if (!row) {
                return 0;
            }
            return typeof row.count === 'bigint' ? Number(row.count) : row.count;
        }
        catch (error) {
            logger_1.logger.warn('Could not count database tables', {
                error: error.message,
            });
            return 0;
        }
    }
    async getFileInfo(filename, basePath, options) {
        const filePath = (0, path_1.join)(basePath, filename);
        if (!(0, fs_1.existsSync)(filePath)) {
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
        const stats = (0, fs_1.statSync)(filePath);
        let sections = 0;
        if (options?.countSections) {
            try {
                const content = (0, fs_1.readFileSync)(filePath, 'utf8');
                sections = (content.match(/^##\s+/gm) || []).length;
            }
            catch (error) {
                logger_1.logger.warn('Could not read file for section count', {
                    error: error.message,
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
    async getHealthStatus() {
        const checks = await Promise.all([
            this.checkDocumentation(),
            this.checkTests(),
            this.checkBuilds(),
        ]);
        const [documentation, tests, builds] = checks;
        const allHealthy = documentation && tests && builds;
        const someWarning = [documentation, tests, builds].filter(Boolean).length >= 2;
        const status = allHealthy
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
    async checkDocumentation() {
        const projectRoot = this.getProjectRoot();
        const criticalFiles = ['CLAUDE.md', 'README.md'];
        for (const file of criticalFiles) {
            if (!(0, fs_1.existsSync)((0, path_1.join)(projectRoot, file))) {
                return false;
            }
        }
        return true;
    }
    async checkTests() {
        try {
            const backendPath = (0, path_1.join)(this.getProjectRoot(), 'Backend');
            const testResultsPath = (0, path_1.join)(backendPath, 'test-results.json');
            if ((0, fs_1.existsSync)(testResultsPath)) {
                const stats = (0, fs_1.statSync)(testResultsPath);
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                return stats.mtime.getTime() > oneDayAgo;
            }
            const backendTestFiles = await this.countFiles('**/*.test.ts', (0, path_1.join)(backendPath, 'src'));
            const frontendTestFiles = await this.countFiles('**/*.test.ts*', (0, path_1.join)(this.getProjectRoot(), 'Frontend', 'src'));
            return backendTestFiles > 0 && frontendTestFiles > 0;
        }
        catch (error) {
            logger_1.logger.warn('Could not check test status', {
                error: error.message,
            });
            return false;
        }
    }
    async checkBuilds() {
        try {
            const backendPath = (0, path_1.join)(this.getProjectRoot(), 'Backend', 'dist');
            const frontendPath = (0, path_1.join)(this.getProjectRoot(), 'Frontend', 'dist');
            return (0, fs_1.existsSync)(backendPath) && (0, fs_1.existsSync)(frontendPath);
        }
        catch (error) {
            logger_1.logger.warn('Could not check build status', {
                error: error.message,
            });
            return false;
        }
    }
    getProjectRoot() {
        return (0, path_1.join)(__dirname, '..', '..');
    }
    async refreshCache() {
        this.cache = null;
        this.cacheExpiry = 0;
        await this.getDocumentationInfo();
    }
}
exports.documentationService = DocumentationService.getInstance();
exports.default = exports.documentationService;
//# sourceMappingURL=documentationService.js.map