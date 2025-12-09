import { utilitiesApi } from '@/lib/api';
import type { DocumentationUpdate } from './context7';

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  hash: string;
  timestamp: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
  description?: string;
  tags: string[];
}

export interface ChangeRecord {
  id: string;
  versionFrom: string;
  versionTo: string;
  timestamp: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
  changes: Array<{
    file: string;
    section?: string;
    changeType: 'added' | 'modified' | 'deleted' | 'moved' | 'renamed';
    oldContent?: string;
    newContent?: string;
    lineNumbers?: {
      old: { start: number; end: number };
      new: { start: number; end: number };
    };
    metadata: {
      size: {
        old: number;
        new: number;
      };
      complexity?: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high' | 'critical';
    };
  }>;
  statistics: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    totalChanges: number;
  };
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  reviewers?: Array<{
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
    notes?: string;
  }>;
}

export interface ConflictInfo {
  id: string;
  file: string;
  section?: string;
  conflictType: 'content' | 'structure' | 'metadata' | 'version';
  currentContent: string;
  incomingContent: string;
  baseContent?: string;
  timestamp: string;
  authors: Array<{
    id: string;
    name: string;
    version: string;
  }>;
  resolutionStrategy?:
    | 'accept_current'
    | 'accept_incoming'
    | 'merge_manual'
    | 'merge_auto';
  resolvedContent?: string;
  resolvedBy?: {
    id: string;
    name: string;
    timestamp: string;
  };
}

export interface BranchInfo {
  id: string;
  name: string;
  description?: string;
  baseVersion: string;
  currentVersion: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
  lastModified: string;
  status: 'active' | 'merged' | 'abandoned';
  changes: ChangeRecord[];
  conflicts: ConflictInfo[];
}

export interface MergeRequest {
  id: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
  status: 'open' | 'merged' | 'closed' | 'draft';
  reviewers: Array<{
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
    notes?: string;
  }>;
  conflicts: ConflictInfo[];
  changes: ChangeRecord[];
  mergeStrategy: 'fast_forward' | 'merge_commit' | 'squash' | 'rebase';
}

class DocumentationVersionControl {
  private static instance: DocumentationVersionControl;
  private currentVersion: VersionInfo | null = null;
  private changeHistory: ChangeRecord[] = [];
  private branches: Map<string, BranchInfo> = new Map();
  private conflicts: Map<string, ConflictInfo> = new Map();
  private mergeRequests: Map<string, MergeRequest> = new Map();

  private constructor() {}

  public static getInstance(): DocumentationVersionControl {
    if (!DocumentationVersionControl.instance) {
      DocumentationVersionControl.instance = new DocumentationVersionControl();
    }
    return DocumentationVersionControl.instance;
  }

  // Version Management
  public async getCurrentVersion(): Promise<VersionInfo | null> {
    try {
      const response = await utilitiesApi.getDocumentationVersion();
      if (response.success && response.data) {
        this.currentVersion = response.data as VersionInfo;
        return this.currentVersion;
      }
      return null;
    } catch (error) {
      console.error('Failed to get current version:', error);
      return null;
    }
  }

  public async createVersion(
    versionType: 'major' | 'minor' | 'patch',
    description?: string,
    tags: string[] = []
  ): Promise<VersionInfo | null> {
    try {
      if (!this.currentVersion) {
        await this.getCurrentVersion();
      }

      const newVersion = this.calculateNextVersion(versionType);
      const versionData = {
        ...newVersion,
        description,
        tags,
        timestamp: new Date().toISOString(),
      };

      // This would typically call an API to create the version
      // For now, we'll simulate it
      const response = await this.simulateVersionCreation(versionData);

      if (response.success) {
        this.currentVersion = response.data;
        return this.currentVersion;
      }

      return null;
    } catch (error) {
      console.error('Failed to create version:', error);
      return null;
    }
  }

  private calculateNextVersion(
    versionType: 'major' | 'minor' | 'patch'
  ): Omit<VersionInfo, 'timestamp' | 'author' | 'description' | 'tags'> {
    const current = this.currentVersion || {
      major: 0,
      minor: 0,
      patch: 0,
      hash: '',
    };

    switch (versionType) {
      case 'major':
        return {
          major: current.major + 1,
          minor: 0,
          patch: 0,
          hash: this.generateVersionHash(),
        };
      case 'minor':
        return {
          major: current.major,
          minor: current.minor + 1,
          patch: 0,
          hash: this.generateVersionHash(),
        };
      case 'patch':
        return {
          major: current.major,
          minor: current.minor,
          patch: current.patch + 1,
          hash: this.generateVersionHash(),
        };
    }
  }

  private generateVersionHash(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  private async simulateVersionCreation(
    versionData: Omit<
      VersionInfo,
      'timestamp' | 'author' | 'description' | 'tags'
    > & { description?: string; tags: string[]; timestamp: string }
  ): Promise<{ success: boolean; data: VersionInfo }> {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      data: {
        ...versionData,
        author: {
          id: 'current_user',
          name: 'Current User',
          role: 'developer',
        },
      },
    };
  }

  // Change Tracking
  public async trackChange(update: DocumentationUpdate): Promise<ChangeRecord> {
    const changeRecord: ChangeRecord = {
      id: this.generateChangeId(),
      versionFrom: this.currentVersion?.hash || 'unknown',
      versionTo: update.version.hash,
      timestamp: update.timestamp,
      author: update.author,
      changes: update.changes.map((change) => ({
        ...change,
        lineNumbers: this.calculateLineNumbers(change),
        metadata: {
          size: {
            old: change.oldContent?.length || 0,
            new: change.newContent?.length || 0,
          },
          complexity: this.calculateComplexity(change),
          impact: update.metadata.impactLevel,
        },
      })),
      statistics: this.calculateStatistics(update.changes),
      reviewStatus: update.metadata.autoApproved ? 'auto_approved' : 'pending',
    };

    this.changeHistory.push(changeRecord);

    // Keep only last 1000 changes in memory
    if (this.changeHistory.length > 1000) {
      this.changeHistory = this.changeHistory.slice(-1000);
    }

    return changeRecord;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private calculateLineNumbers(change: DocumentationUpdate['changes'][0]): {
    old: { start: number; end: number };
    new: { start: number; end: number };
  } {
    // This would typically analyze the actual content to determine line numbers
    // For now, we'll provide a simplified implementation
    const oldLines = change.oldContent?.split('\n').length || 0;
    const newLines = change.newContent?.split('\n').length || 0;

    return {
      old: { start: 1, end: oldLines },
      new: { start: 1, end: newLines },
    };
  }

  private calculateComplexity(
    change: DocumentationUpdate['changes'][0]
  ): 'low' | 'medium' | 'high' {
    const contentLength = (change.newContent || change.oldContent || '').length;

    if (contentLength < 100) {
      return 'low';
    }
    if (contentLength < 500) {
      return 'medium';
    }
    return 'high';
  }

  private calculateStatistics(
    changes: DocumentationUpdate['changes']
  ): ChangeRecord['statistics'] {
    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;

    const uniqueFiles = new Set();

    changes.forEach((change) => {
      uniqueFiles.add(change.file);

      const oldLines = change.oldContent?.split('\n').length || 0;
      const newLines = change.newContent?.split('\n').length || 0;

      switch (change.changeType) {
        case 'added':
          linesAdded += newLines;
          break;
        case 'deleted':
          linesRemoved += oldLines;
          break;
        case 'modified':
          linesModified += Math.max(oldLines, newLines);
          break;
      }
    });

    return {
      filesChanged: uniqueFiles.size,
      linesAdded,
      linesRemoved,
      linesModified,
      totalChanges: changes.length,
    };
  }

  // Change History
  public async getChangeHistory(
    options: {
      limit?: number;
      offset?: number;
      since?: string;
      author?: string;
      file?: string;
    } = {}
  ): Promise<ChangeRecord[]> {
    try {
      const response = await utilitiesApi.getDocumentationHistory(options);
      if (response.success && response.data) {
        return response.data as ChangeRecord[];
      }
      return [];
    } catch (error) {
      console.error('Failed to get change history:', error);
      return [];
    }
  }

  public getLocalChangeHistory(): ChangeRecord[] {
    return [...this.changeHistory];
  }

  // Conflict Management
  public async detectConflicts(
    update: DocumentationUpdate
  ): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    for (const change of update.changes) {
      // Check for concurrent modifications
      const existingChanges = this.changeHistory.filter(
        (record) =>
          record.changes.some((c) => c.file === change.file) &&
          record.timestamp > (this.currentVersion?.timestamp || '0')
      );

      if (existingChanges.length > 0) {
        const conflict: ConflictInfo = {
          id: this.generateConflictId(),
          file: change.file,
          ...(change.section && { section: change.section }),
          conflictType: 'content',
          currentContent: change.oldContent || '',
          incomingContent: change.newContent || '',
          timestamp: new Date().toISOString(),
          authors: [
            {
              id: update.author.id,
              name: update.author.name,
              version: `${update.version.major}.${update.version.minor}.${update.version.patch}`,
            },
            ...existingChanges.map((c) => ({
              id: c.author.id,
              name: c.author.name,
              version: c.versionTo,
            })),
          ],
        };

        conflicts.push(conflict);
        this.conflicts.set(conflict.id, conflict);
      }
    }

    return conflicts;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  public async resolveConflict(
    conflictId: string,
    resolution: {
      strategy: 'accept_current' | 'accept_incoming' | 'merge_manual';
      mergedContent?: string;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const response = await utilitiesApi.resolveDocumentationConflict(
        conflictId,
        resolution
      );

      if (response.success) {
        const conflict = this.conflicts.get(conflictId);
        if (conflict) {
          conflict.resolutionStrategy = resolution.strategy;
          conflict.resolvedContent =
            resolution.mergedContent || conflict.currentContent;
          conflict.resolvedBy = {
            id: 'current_user',
            name: 'Current User',
            timestamp: new Date().toISOString(),
          };
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }

  // Rollback functionality
  public async rollbackToVersion(
    versionHash: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const response = await utilitiesApi.rollbackDocumentation(versionHash, {
        reason: reason || 'Manual rollback',
      });

      if (response.success) {
        // Update current version
        await this.getCurrentVersion();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to rollback to version:', error);
      return false;
    }
  }

  // Comparison utilities
  public compareVersions(
    version1: string,
    _version2: string
  ): Promise<ChangeRecord[]> {
    // This would typically call an API to get the diff between versions
    return this.getChangeHistory({
      since: version1,
      limit: 100,
    });
  }

  public async generateDiff(
    _file: string,
    _version1: string,
    _version2: string
  ): Promise<{
    additions: string[];
    deletions: string[];
    modifications: Array<{ old: string; new: string; line: number }>;
  }> {
    // This would typically generate a detailed diff
    // For now, we'll return a simplified structure
    return {
      additions: [],
      deletions: [],
      modifications: [],
    };
  }

  // Validation
  public async validateVersion(_versionHash: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const response = await utilitiesApi.validateDocumentationIntegrity();

      if (response.success) {
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      }

      return {
        isValid: false,
        errors: ['Validation failed'],
        warnings: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }

  // Cleanup
  public clearHistory(): void {
    this.changeHistory = [];
    this.conflicts.clear();
    this.branches.clear();
    this.mergeRequests.clear();
  }

  // Export/Import
  public exportHistory(): {
    version: VersionInfo | null;
    changes: ChangeRecord[];
    conflicts: ConflictInfo[];
  } {
    return {
      version: this.currentVersion,
      changes: this.changeHistory,
      conflicts: Array.from(this.conflicts.values()),
    };
  }

  public importHistory(data: {
    version?: VersionInfo;
    changes?: ChangeRecord[];
    conflicts?: ConflictInfo[];
  }): void {
    if (data.version) {
      this.currentVersion = data.version;
    }

    if (data.changes) {
      this.changeHistory = data.changes;
    }

    if (data.conflicts) {
      this.conflicts.clear();
      data.conflicts.forEach((conflict) => {
        this.conflicts.set(conflict.id, conflict);
      });
    }
  }
}

// Export singleton instance
export const documentationVersionControl =
  DocumentationVersionControl.getInstance();

export default documentationVersionControl;
