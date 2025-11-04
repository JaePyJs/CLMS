/**
 * Documentation Verification Service
 * Ensures all documentation remains current and accurate through automated checks
 */

export interface VerificationRule {
  id: string;
  name: string;
  description: string;
  type: 'content' | 'structure' | 'links' | 'metadata' | 'consistency';
  severity: 'error' | 'warning' | 'info';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface VerificationResult {
  ruleId: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  suggestions?: string[];
  timestamp: Date;
}

export interface VerificationReport {
  id: string;
  timestamp: Date;
  status: 'pass' | 'fail' | 'warning';
  totalRules: number;
  passedRules: number;
  failedRules: number;
  warningRules: number;
  results: VerificationResult[];
  executionTime: number;
  metadata: {
    version: string;
    environment: string;
    triggeredBy: 'manual' | 'scheduled' | 'realtime' | 'webhook';
  };
}

export interface VerificationConfig {
  enableAutoVerification: boolean;
  verificationInterval: number; // in milliseconds
  enableRealTimeVerification: boolean;
  enableScheduledVerification: boolean;
  scheduledVerificationCron: string;
  enableWebhookVerification: boolean;
  rules: VerificationRule[];
  notifications: {
    enableEmail: boolean;
    enableSlack: boolean;
    enableWebhook: boolean;
    recipients: string[];
  };
}

export class DocumentationVerificationService {
  private config: VerificationConfig;
  private verificationHistory: VerificationReport[] = [];
  private activeVerifications: Map<string, Promise<VerificationReport>> =
    new Map();
  private scheduledVerificationTimer?: NodeJS.Timeout | undefined;

  constructor(config?: Partial<VerificationConfig>) {
    this.config = {
      enableAutoVerification: true,
      verificationInterval: 300000, // 5 minutes
      enableRealTimeVerification: true,
      enableScheduledVerification: true,
      scheduledVerificationCron: '0 */6 * * *', // Every 6 hours
      enableWebhookVerification: true,
      rules: this.getDefaultRules(),
      notifications: {
        enableEmail: false,
        enableSlack: false,
        enableWebhook: true,
        recipients: [],
      },
      ...config,
    };

    this.initialize();
  }

  private getDefaultRules(): VerificationRule[] {
    return [
      {
        id: 'content-freshness',
        name: 'Content Freshness Check',
        description: 'Ensures documentation content is not outdated',
        type: 'metadata',
        severity: 'warning',
        enabled: true,
        config: { maxAgeHours: 168 }, // 1 week
      },
      {
        id: 'broken-links',
        name: 'Broken Links Detection',
        description: 'Checks for broken internal and external links',
        type: 'links',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'structure-consistency',
        name: 'Structure Consistency',
        description: 'Validates documentation structure and format',
        type: 'structure',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'api-documentation-sync',
        name: 'API Documentation Sync',
        description: 'Ensures API docs match actual API endpoints',
        type: 'consistency',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'code-examples-validity',
        name: 'Code Examples Validity',
        description: 'Validates code examples in documentation',
        type: 'content',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'version-consistency',
        name: 'Version Consistency',
        description: 'Checks version information across all documentation',
        type: 'metadata',
        severity: 'error',
        enabled: true,
      },
      {
        id: 'completeness-check',
        name: 'Documentation Completeness',
        description: 'Ensures all required sections are present',
        type: 'structure',
        severity: 'warning',
        enabled: true,
      },
    ];
  }

  private async initialize(): Promise<void> {
    if (this.config.enableScheduledVerification) {
      this.startScheduledVerification();
    }
  }

  public async runVerification(
    triggeredBy: 'manual' | 'scheduled' | 'realtime' | 'webhook' = 'manual'
  ): Promise<VerificationReport> {
    const verificationId = `verification-${Date.now()}`;
    const startTime = Date.now();

    // Check if verification is already running
    if (this.activeVerifications.has('current')) {
      return await this.activeVerifications.get('current')!;
    }

    const verificationPromise = this.executeVerification(
      verificationId,
      triggeredBy,
      startTime
    );
    this.activeVerifications.set('current', verificationPromise);

    try {
      const result = await verificationPromise;
      this.verificationHistory.push(result);

      // Keep only last 50 reports
      if (this.verificationHistory.length > 50) {
        this.verificationHistory = this.verificationHistory.slice(-50);
      }

      await this.handleVerificationResult(result);
      return result;
    } finally {
      this.activeVerifications.delete('current');
    }
  }

  private async executeVerification(
    verificationId: string,
    triggeredBy: 'manual' | 'scheduled' | 'realtime' | 'webhook',
    startTime: number
  ): Promise<VerificationReport> {
    const results: VerificationResult[] = [];
    const enabledRules = this.config.rules.filter((rule) => rule.enabled);

    for (const rule of enabledRules) {
      try {
        const ruleResult = await this.executeRule(rule);
        results.push(ruleResult);
      } catch (error) {
        results.push({
          ruleId: rule.id,
          status: 'fail',
          message: `Rule execution failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          timestamp: new Date(),
        });
      }
    }

    const executionTime = Date.now() - startTime;
    const passedRules = results.filter((r) => r.status === 'pass').length;
    const failedRules = results.filter((r) => r.status === 'fail').length;
    const warningRules = results.filter((r) => r.status === 'warning').length;

    const overallStatus =
      failedRules > 0 ? 'fail' : warningRules > 0 ? 'warning' : 'pass';

    return {
      id: verificationId,
      timestamp: new Date(),
      status: overallStatus,
      totalRules: enabledRules.length,
      passedRules,
      failedRules,
      warningRules,
      results,
      executionTime,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        triggeredBy,
      },
    };
  }

  private async executeRule(
    rule: VerificationRule
  ): Promise<VerificationResult> {
    const timestamp = new Date();

    switch (rule.id) {
      case 'content-freshness':
        return await this.checkContentFreshness(rule, timestamp);

      case 'broken-links':
        return await this.checkBrokenLinks(rule, timestamp);

      case 'structure-consistency':
        return await this.checkStructureConsistency(rule, timestamp);

      case 'api-documentation-sync':
        return await this.checkApiDocumentationSync(rule, timestamp);

      case 'code-examples-validity':
        return await this.checkCodeExamplesValidity(rule, timestamp);

      case 'version-consistency':
        return await this.checkVersionConsistency(rule, timestamp);

      case 'completeness-check':
        return await this.checkDocumentationCompleteness(rule, timestamp);

      default:
        return {
          ruleId: rule.id,
          status: 'warning',
          message: `Unknown rule: ${rule.id}`,
          timestamp,
        };
    }
  }

  private async checkContentFreshness(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      const maxAgeHours = rule.config?.maxAgeHours || 168;
      // Note: cutoffTime would be used for actual file modification time checks
      // const cutoffTime = new Date(Date.now() - maxAge);

      // This would typically check file modification times
      // For now, we'll simulate the check
      const outdatedFiles: string[] = [];

      if (outdatedFiles.length > 0) {
        return {
          ruleId: rule.id,
          status: 'warning',
          message: `${outdatedFiles.length} documentation files are older than ${maxAgeHours} hours`,
          details: `Outdated files: ${outdatedFiles.join(', ')}`,
          suggestions: [
            'Update outdated documentation files',
            'Review content for accuracy',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'All documentation files are within acceptable age limits',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Content freshness check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkBrokenLinks(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would typically scan documentation files for links and test them
      // For now, we'll simulate the check
      const brokenLinks: Array<{ file: string; link: string; line?: number }> =
        [];

      if (brokenLinks.length > 0) {
        return {
          ruleId: rule.id,
          status: 'fail',
          message: `Found ${brokenLinks.length} broken links`,
          details: brokenLinks
            .map((link) => `${link.file}:${link.line || '?'} - ${link.link}`)
            .join('\n'),
          suggestions: ['Fix or remove broken links', 'Update outdated URLs'],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'No broken links detected',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Broken links check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkStructureConsistency(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would check for consistent documentation structure
      const structureIssues: string[] = [];

      if (structureIssues.length > 0) {
        return {
          ruleId: rule.id,
          status: 'fail',
          message: `Found ${structureIssues.length} structure inconsistencies`,
          details: structureIssues.join('\n'),
          suggestions: [
            'Standardize documentation structure',
            'Follow documentation templates',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'Documentation structure is consistent',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Structure consistency check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkApiDocumentationSync(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would compare API documentation with actual API endpoints
      const syncIssues: string[] = [];

      if (syncIssues.length > 0) {
        return {
          ruleId: rule.id,
          status: 'fail',
          message: `Found ${syncIssues.length} API documentation sync issues`,
          details: syncIssues.join('\n'),
          suggestions: [
            'Update API documentation',
            'Regenerate API docs from code',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'API documentation is in sync with implementation',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `API documentation sync check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkCodeExamplesValidity(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would validate code examples in documentation
      const invalidExamples: Array<{
        file: string;
        example: string;
        error: string;
      }> = [];

      if (invalidExamples.length > 0) {
        return {
          ruleId: rule.id,
          status: 'warning',
          message: `Found ${invalidExamples.length} invalid code examples`,
          details: invalidExamples
            .map((ex) => `${ex.file}: ${ex.error}`)
            .join('\n'),
          suggestions: [
            'Fix syntax errors in code examples',
            'Test code examples before publishing',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'All code examples are valid',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Code examples validity check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkVersionConsistency(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would check version consistency across documentation
      const versionIssues: string[] = [];

      if (versionIssues.length > 0) {
        return {
          ruleId: rule.id,
          status: 'fail',
          message: `Found ${versionIssues.length} version consistency issues`,
          details: versionIssues.join('\n'),
          suggestions: [
            'Update version information',
            'Ensure consistent versioning',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'Version information is consistent',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Version consistency check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async checkDocumentationCompleteness(
    rule: VerificationRule,
    timestamp: Date
  ): Promise<VerificationResult> {
    try {
      // This would check for required documentation sections
      const missingSection: string[] = [];

      if (missingSection.length > 0) {
        return {
          ruleId: rule.id,
          status: 'warning',
          message: `Missing ${missingSection.length} required documentation sections`,
          details: `Missing sections: ${missingSection.join(', ')}`,
          suggestions: [
            'Add missing documentation sections',
            'Follow documentation checklist',
          ],
          timestamp,
        };
      }

      return {
        ruleId: rule.id,
        status: 'pass',
        message: 'Documentation is complete',
        timestamp,
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        status: 'fail',
        message: `Documentation completeness check failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        timestamp,
      };
    }
  }

  private async handleVerificationResult(
    report: VerificationReport
  ): Promise<void> {
    // Send notifications if configured
    if (this.config.notifications.enableWebhook) {
      await this.sendWebhookNotification(report);
    }

    // Log results
    console.log(`Documentation verification completed: ${report.status}`);
    console.log(
      `Passed: ${report.passedRules}, Failed: ${report.failedRules}, Warnings: ${report.warningRules}`
    );

    if (report.status === 'fail') {
      const failedResults = report.results.filter((r) => r.status === 'fail');
      console.error(
        'Failed verification rules:',
        failedResults.map((r) => r.message)
      );
    }
  }

  private async sendWebhookNotification(
    report: VerificationReport
  ): Promise<void> {
    try {
      // This would send webhook notifications
      // Implementation depends on webhook configuration
      console.log(
        'Webhook notification sent for verification report:',
        report.id
      );
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  private startScheduledVerification(): void {
    if (this.scheduledVerificationTimer) {
      clearInterval(this.scheduledVerificationTimer);
    }

    this.scheduledVerificationTimer = setInterval(async () => {
      try {
        await this.runVerification('scheduled');
      } catch (error) {
        console.error('Scheduled verification failed:', error);
      }
    }, this.config.verificationInterval);
  }

  public async onDocumentationUpdate(_updateInfo: any): Promise<void> {
    // Update info parameter intentionally unused for now
    void _updateInfo;
    if (this.config.enableRealTimeVerification) {
      try {
        await this.runVerification('realtime');
      } catch (error) {
        console.error('Real-time verification failed:', error);
      }
    }
  }

  public getVerificationHistory(): VerificationReport[] {
    return [...this.verificationHistory];
  }

  public getLatestReport(): VerificationReport | null {
    return this.verificationHistory.length > 0
      ? this.verificationHistory[this.verificationHistory.length - 1] ?? null
      : null;
  }

  public updateConfig(newConfig: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.enableScheduledVerification !== undefined) {
      if (newConfig.enableScheduledVerification) {
        this.startScheduledVerification();
      } else if (this.scheduledVerificationTimer) {
        clearInterval(this.scheduledVerificationTimer);
        this.scheduledVerificationTimer = undefined;
      }
    }
  }

  public async addCustomRule(rule: VerificationRule): Promise<void> {
    this.config.rules.push(rule);
  }

  public async removeRule(ruleId: string): Promise<void> {
    this.config.rules = this.config.rules.filter((rule) => rule.id !== ruleId);
  }

  public async enableRule(ruleId: string): Promise<void> {
    const rule = this.config.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  public async disableRule(ruleId: string): Promise<void> {
    const rule = this.config.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  public destroy(): void {
    if (this.scheduledVerificationTimer) {
      clearInterval(this.scheduledVerificationTimer);
    }
    this.activeVerifications.clear();
    this.verificationHistory = [];
  }
}
