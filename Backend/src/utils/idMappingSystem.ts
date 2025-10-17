import { prisma } from './prisma';
import { logger } from './logger';
import { getCacheManager, CacheManager } from './redis';
import { performanceLogger } from './logger';

/**
 * Entity types supported by the ID mapping system
 */
export enum EntityType {
  STUDENT = 'student',
  BOOK = 'book',
  EQUIPMENT = 'equipment',
  USER = 'user',
  CHECKOUT = 'checkout'
}

/**
 * Mapping direction for lookups
 */
export enum MappingDirection {
  EXTERNAL_TO_INTERNAL = 'external_to_internal',
  INTERNAL_TO_EXTERNAL = 'internal_to_external'
}

/**
 * ID mapping entry interface
 */
export interface IDMapping {
  id: string;
  entityType: EntityType;
  externalId: string;
  internalId: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
  accessCount: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

/**
 * Bulk mapping operation result
 */
export interface BulkMappingResult {
  success: number;
  failed: number;
  errors: Array<{
    externalId: string;
    error: string;
  }>;
  duration: number;
}

/**
 * Mapping statistics interface
 */
export interface MappingStats {
  entityType: EntityType;
  totalMappings: number;
  activeMappings: number;
  inactiveMappings: number;
  staleMappings: number;
  averageAccessCount: number;
  mostAccessedMappings: Array<{
    externalId: string;
    internalId: string;
    accessCount: number;
  }>;
  lastAccessed: Date | null;
  createdAt: Date;
}

/**
 * Mapping validation result
 */
export interface ValidationResult {
  isValid: boolean;
  issues: Array<{
    type: 'duplicate' | 'orphaned' | 'inconsistent' | 'missing';
    externalId?: string;
    internalId?: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  totalChecked: number;
  validMappings: number;
  invalidMappings: number;
}

/**
 * Configuration for ID mapping system
 */
export interface IDMappingConfig {
  redisKeyPrefix?: string;
  defaultTTL?: number;
  enableAnalytics?: boolean;
  enableValidation?: boolean;
  cleanupInterval?: number;
  maxCacheSize?: number;
  batchSize?: number;
  enableMetrics?: boolean;
}

/**
 * Comprehensive ID mapping system with Redis caching and database persistence
 * Supports bidirectional lookups, bulk operations, analytics, and validation
 */
export class IDMappingManager {
  private cacheManager: CacheManager | null = null;
  private config: Required<IDMappingConfig>;
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: IDMappingConfig = {}) {
    this.config = {
      redisKeyPrefix: config.redisKeyPrefix || 'id_mapping:',
      defaultTTL: config.defaultTTL || 24 * 60 * 60 * 1000, // 24 hours
      enableAnalytics: config.enableAnalytics !== false,
      enableValidation: config.enableValidation !== false,
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000, // 1 hour
      maxCacheSize: config.maxCacheSize || 10000,
      batchSize: config.batchSize || 100,
      enableMetrics: config.enableMetrics !== false
    };

    logger.info('IDMappingManager initialized', {
      redisKeyPrefix: this.config.redisKeyPrefix,
      defaultTTL: this.config.defaultTTL,
      enableAnalytics: this.config.enableAnalytics,
      enableValidation: this.config.enableValidation
    });
  }

  /**
   * Initialize the ID mapping system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('IDMappingManager already initialized');
      return;
    }

    try {
      // Initialize cache manager
      this.cacheManager = await getCacheManager();
      
      // Start cleanup timer
      if (this.config.cleanupInterval > 0) {
        this.startCleanupTimer();
      }

      this.isInitialized = true;
      logger.info('IDMappingManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize IDMappingManager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create a new ID mapping
   */
  async createMapping(
    entityType: EntityType,
    externalId: string,
    internalId: string,
    metadata?: Record<string, any>
  ): Promise<IDMapping> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('create_mapping', { entityType, externalId });

    try {
      // Validate inputs
      this.validateMappingInputs(entityType, externalId, internalId);

      // Check if mapping already exists
      const existingMapping = await this.getMappingByExternalId(entityType, externalId);
      if (existingMapping) {
        logger.warn('Mapping already exists, updating instead', {
          entityType,
          externalId,
          existingInternalId: existingMapping.internalId,
          newInternalId: internalId
        });
        return this.updateMapping(entityType, externalId, internalId, metadata);
      }

      // Create mapping in database
      const mapping = await prisma.id_mappings.create({
        data: {
          entityType,
          externalId,
          internalId,
          metadata: metadata ? JSON.stringify(metadata) : null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0
        }
      });

      // Cache the mapping
      await this.cacheMapping(entityType, externalId, internalId);

      // Log analytics
      if (this.config.enableAnalytics) {
        logger.info('Mapping created', {
          entityType,
          externalId,
          internalId,
          mappingId: mapping.id
        });
      }

      performanceLogger.end('create_mapping', startTime, { entityType, success: true });
      
      return this.formatMapping(mapping);
    } catch (error) {
      performanceLogger.end('create_mapping', startTime, { entityType, success: false });
      logger.error('Failed to create mapping', {
        entityType,
        externalId,
        internalId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get internal ID from external ID
   */
  async getInternalId(entityType: EntityType, externalId: string): Promise<string | null> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('get_internal_id', { entityType, externalId });

    try {
      // Try cache first
      const cachedId = await this.getCachedMapping(entityType, externalId, MappingDirection.EXTERNAL_TO_INTERNAL);
      if (cachedId) {
        await this.updateAccessStats(entityType, externalId);
        performanceLogger.end('get_internal_id', startTime, { entityType, cacheHit: true });
        return cachedId;
      }

      // Fallback to database
      const mapping = await prisma.id_mappings.findFirst({
        where: {
          entityType,
          externalId,
          isActive: true
        }
      });

      if (mapping) {
        // Cache the result
        await this.cacheMapping(entityType, externalId, mapping.internalId);
        await this.updateAccessStats(entityType, externalId);
        performanceLogger.end('get_internal_id', startTime, { entityType, cacheHit: false });
        return mapping.internalId;
      }

      performanceLogger.end('get_internal_id', startTime, { entityType, cacheHit: false, found: false });
      return null;
    } catch (error) {
      performanceLogger.end('get_internal_id', startTime, { entityType, success: false });
      logger.error('Failed to get internal ID', {
        entityType,
        externalId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get external ID from internal ID
   */
  async getExternalId(entityType: EntityType, internalId: string): Promise<string | null> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('get_external_id', { entityType, internalId });

    try {
      // Try cache first
      const cachedId = await this.getCachedMapping(entityType, internalId, MappingDirection.INTERNAL_TO_EXTERNAL);
      if (cachedId) {
        performanceLogger.end('get_external_id', startTime, { entityType, cacheHit: true });
        return cachedId;
      }

      // Fallback to database
      const mapping = await prisma.id_mappings.findFirst({
        where: {
          entityType,
          internalId,
          isActive: true
        }
      });

      if (mapping) {
        // Cache the result
        await this.cacheMapping(entityType, mapping.externalId, internalId);
        performanceLogger.end('get_external_id', startTime, { entityType, cacheHit: false });
        return mapping.externalId;
      }

      performanceLogger.end('get_external_id', startTime, { entityType, cacheHit: false, found: false });
      return null;
    } catch (error) {
      performanceLogger.end('get_external_id', startTime, { entityType, success: false });
      logger.error('Failed to get external ID', {
        entityType,
        internalId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Create multiple mappings in bulk
   */
  async bulkCreateMappings(
    entityType: EntityType,
    mappings: Array<{ externalId: string; internalId: string; metadata?: Record<string, any> }>
  ): Promise<BulkMappingResult> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('bulk_create_mappings', { 
      entityType, 
      count: mappings.length 
    });

    const result: BulkMappingResult = {
      success: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    try {
      // Process in batches
      for (let i = 0; i < mappings.length; i += this.config.batchSize) {
        const batch = mappings.slice(i, i + this.config.batchSize);
        
        for (const { externalId, internalId, metadata } of batch) {
          try {
            await this.createMapping(entityType, externalId, internalId, metadata);
            result.success++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              externalId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      result.duration = Date.now() - startTime;
      performanceLogger.end('bulk_create_mappings', startTime, { 
        entityType, 
        success: result.success, 
        failed: result.failed 
      });

      logger.info('Bulk mapping creation completed', {
        entityType,
        total: mappings.length,
        success: result.success,
        failed: result.failed,
        duration: result.duration
      });

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      performanceLogger.end('bulk_create_mappings', startTime, { entityType, success: false });
      logger.error('Bulk mapping creation failed', {
        entityType,
        count: mappings.length,
        error: error instanceof Error ? error.message : String(error)
      });
      return result;
    }
  }

  /**
   * Get mapping statistics for an entity type
   */
  async getMappingStats(entityType: EntityType): Promise<MappingStats> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('get_mapping_stats', { entityType });

    try {
      const stats = await prisma.id_mappings.groupBy({
        by: ['isActive'],
        where: { entityType },
        _count: { id: true },
        _avg: { accessCount: true },
        _max: { lastAccessed: true, createdAt: true }
      });

      const totalMappings = stats.reduce((sum, stat) => sum + stat._count.id, 0);
      const activeMappings = stats.find(stat => stat.isActive)?._count.id || 0;
      const inactiveMappings = stats.find(stat => !stat.isActive)?._count.id || 0;
      const averageAccessCount = stats[0]?._avg.accessCount || 0;

      // Get most accessed mappings
      const mostAccessedMappings = await prisma.id_mappings.findMany({
        where: { entityType, isActive: true },
        orderBy: { accessCount: 'desc' },
        take: 10,
        select: {
          externalId: true,
          internalId: true,
          accessCount: true
        }
      });

      // Get stale mappings (not accessed in 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const staleMappings = await prisma.id_mappings.count({
        where: {
          entityType,
          isActive: true,
          lastAccessed: { lt: thirtyDaysAgo }
        }
      });

      const result: MappingStats = {
        entityType,
        totalMappings,
        activeMappings,
        inactiveMappings,
        staleMappings,
        averageAccessCount,
        mostAccessedMappings,
        lastAccessed: stats[0]?._max.lastAccessed || null,
        createdAt: stats[0]?._max.createdAt || new Date()
      };

      performanceLogger.end('get_mapping_stats', startTime, { entityType });
      return result;
    } catch (error) {
      performanceLogger.end('get_mapping_stats', startTime, { entityType, success: false });
      logger.error('Failed to get mapping stats', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate mappings for an entity type
   */
  async validateMappings(entityType: EntityType): Promise<ValidationResult> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('validate_mappings', { entityType });

    const result: ValidationResult = {
      isValid: true,
      issues: [],
      totalChecked: 0,
      validMappings: 0,
      invalidMappings: 0
    };

    try {
      // Get all mappings for the entity type
      const mappings = await prisma.id_mappings.findMany({
        where: { entityType }
      });

      result.totalChecked = mappings.length;

      // Check for duplicate external IDs
      const externalIdGroups = new Map<string, number>();
      for (const mapping of mappings) {
        const count = externalIdGroups.get(mapping.externalId) || 0;
        externalIdGroups.set(mapping.externalId, count + 1);
      }

      for (const [externalId, count] of externalIdGroups) {
        if (count > 1) {
          result.issues.push({
            type: 'duplicate',
            externalId,
            description: `External ID ${externalId} has ${count} mappings`,
            severity: 'high'
          });
          result.isValid = false;
        }
      }

      // Check for orphaned mappings (internal ID doesn't exist in actual entity table)
      for (const mapping of mappings) {
        let entityExists = false;
        
        switch (entityType) {
          case EntityType.STUDENT:
            entityExists = !!(await prisma.students.findUnique({
              where: { id: mapping.internalId }
            }));
            break;
          case EntityType.BOOK:
            entityExists = !!(await prisma.books.findUnique({
              where: { id: mapping.internalId }
            }));
            break;
          case EntityType.EQUIPMENT:
            entityExists = !!(await prisma.equipment.findUnique({
              where: { id: mapping.internalId }
            }));
            break;
          case EntityType.USER:
            entityExists = !!(await prisma.users.findUnique({
              where: { id: mapping.internalId }
            }));
            break;
          case EntityType.CHECKOUT:
            entityExists = !!(await prisma.book_checkouts.findUnique({
              where: { id: mapping.internalId }
            }));
            break;
        }

        if (!entityExists) {
          result.issues.push({
            type: 'orphaned',
            externalId: mapping.externalId,
            internalId: mapping.internalId,
            description: `Internal ID ${mapping.internalId} does not exist in ${entityType} table`,
            severity: 'medium'
          });
          result.isValid = false;
        } else {
          result.validMappings++;
        }
      }

      result.invalidMappings = result.totalChecked - result.validMappings;

      performanceLogger.end('validate_mappings', startTime, { 
        entityType, 
        totalChecked: result.totalChecked,
        validMappings: result.validMappings,
        invalidMappings: result.invalidMappings
      });

      logger.info('Mapping validation completed', {
        entityType,
        totalChecked: result.totalChecked,
        validMappings: result.validMappings,
        invalidMappings: result.invalidMappings,
        issuesFound: result.issues.length
      });

      return result;
    } catch (error) {
      performanceLogger.end('validate_mappings', startTime, { entityType, success: false });
      logger.error('Failed to validate mappings', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up stale mappings
   */
  async cleanupStaleMappings(entityType: EntityType, olderThan: Date): Promise<number> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('cleanup_stale_mappings', { 
      entityType, 
      olderThan: olderThan.toISOString() 
    });

    try {
      // Delete stale mappings from database
      const deleteResult = await prisma.id_mappings.deleteMany({
        where: {
          entityType,
          lastAccessed: { lt: olderThan },
          isActive: true
        }
      });

      // Clear cache for this entity type
      await this.clearEntityTypeCache(entityType);

      const deletedCount = deleteResult.count;
      performanceLogger.end('cleanup_stale_mappings', startTime, { 
        entityType, 
        deletedCount 
      });

      logger.info('Stale mappings cleanup completed', {
        entityType,
        olderThan: olderThan.toISOString(),
        deletedCount
      });

      return deletedCount;
    } catch (error) {
      performanceLogger.end('cleanup_stale_mappings', startTime, { entityType, success: false });
      logger.error('Failed to cleanup stale mappings', {
        entityType,
        olderThan: olderThan.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update an existing mapping
   */
  private async updateMapping(
    entityType: EntityType,
    externalId: string,
    internalId: string,
    metadata?: Record<string, any>
  ): Promise<IDMapping> {
    const mapping = await prisma.id_mappings.updateMany({
      where: {
        entityType,
        externalId
      },
      data: {
        internalId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        updatedAt: new Date(),
        isActive: true
      }
    });

    // Update cache
    await this.cacheMapping(entityType, externalId, internalId);

    // Get the updated mapping
    const updatedMapping = await this.getMappingByExternalId(entityType, externalId);
    if (!updatedMapping) {
      throw new Error('Failed to retrieve updated mapping');
    }

    return updatedMapping;
  }

  /**
   * Get mapping by external ID
   */
  private async getMappingByExternalId(
    entityType: EntityType,
    externalId: string
  ): Promise<IDMapping | null> {
    const mapping = await prisma.id_mappings.findFirst({
      where: {
        entityType,
        externalId
      }
    });

    return mapping ? this.formatMapping(mapping) : null;
  }

  /**
   * Cache a mapping in Redis
   */
  private async cacheMapping(
    entityType: EntityType,
    externalId: string,
    internalId: string
  ): Promise<void> {
    if (!this.cacheManager) return;

    try {
      const externalKey = `${this.config.redisKeyPrefix}${entityType}:external:${externalId}`;
      const internalKey = `${this.config.redisKeyPrefix}${entityType}:internal:${internalId}`;

      await Promise.all([
        this.cacheManager.set(externalKey, internalId, this.config.defaultTTL),
        this.cacheManager.set(internalKey, externalId, this.config.defaultTTL)
      ]);
    } catch (error) {
      logger.warn('Failed to cache mapping', {
        entityType,
        externalId,
        internalId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get cached mapping
   */
  private async getCachedMapping(
    entityType: EntityType,
    id: string,
    direction: MappingDirection
  ): Promise<string | null> {
    if (!this.cacheManager) return null;

    try {
      const key = direction === MappingDirection.EXTERNAL_TO_INTERNAL
        ? `${this.config.redisKeyPrefix}${entityType}:external:${id}`
        : `${this.config.redisKeyPrefix}${entityType}:internal:${id}`;

      return await this.cacheManager.get(key);
    } catch (error) {
      logger.warn('Failed to get cached mapping', {
        entityType,
        id,
        direction,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Update access statistics for a mapping
   */
  private async updateAccessStats(
    entityType: EntityType,
    externalId: string
  ): Promise<void> {
    try {
      await prisma.id_mappings.updateMany({
        where: {
          entityType,
          externalId
        },
        data: {
          lastAccessed: new Date(),
          accessCount: { increment: 1 }
        }
      });
    } catch (error) {
      logger.warn('Failed to update access stats', {
        entityType,
        externalId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clear cache for an entity type
   */
  private async clearEntityTypeCache(entityType: EntityType): Promise<void> {
    if (!this.cacheManager) return;

    try {
      // This is a simplified approach - in production, you might want to use
      // Redis SCAN to find all keys for the entity type
      const pattern = `${this.config.redisKeyPrefix}${entityType}:*`;
      logger.info('Clearing cache for entity type', { entityType, pattern });
      // Note: Implement actual key deletion based on your Redis client capabilities
    } catch (error) {
      logger.warn('Failed to clear entity type cache', {
        entityType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Validate mapping inputs
   */
  private validateMappingInputs(
    entityType: EntityType,
    externalId: string,
    internalId: string
  ): void {
    if (!Object.values(EntityType).includes(entityType)) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    if (!externalId || externalId.trim().length === 0) {
      throw new Error('External ID cannot be empty');
    }

    if (!internalId || internalId.trim().length === 0) {
      throw new Error('Internal ID cannot be empty');
    }
  }

  /**
   * Format mapping from database record
   */
  private formatMapping(record: any): IDMapping {
    return {
      id: record.id,
      entityType: record.entityType as EntityType,
      externalId: record.externalId,
      internalId: record.internalId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAccessed: record.lastAccessed,
      accessCount: record.accessCount,
      isActive: record.isActive,
      metadata: record.metadata ? JSON.parse(record.metadata) : undefined
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const entityType of Object.values(EntityType)) {
          await this.cleanupStaleMappings(entityType, thirtyDaysAgo);
        }
      } catch (error) {
        logger.error('Automatic cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('IDMappingManager is not initialized. Call initialize() first.');
    }
  }

  /**
   * Disconnect and cleanup resources
   */
  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.isInitialized = false;
    logger.info('IDMappingManager disconnected');
  }
}

// Export singleton instance
let idMappingManager: IDMappingManager | null = null;

/**
 * Get or create the ID mapping manager singleton
 */
export const getIDMappingManager = async (config?: IDMappingConfig): Promise<IDMappingManager> => {
  if (!idMappingManager) {
    idMappingManager = new IDMappingManager(config);
    await idMappingManager.initialize();
  }
  return idMappingManager;
};

/**
 * Disconnect the ID mapping manager
 */
export const disconnectIDMappingManager = async (): Promise<void> => {
  if (idMappingManager) {
    await idMappingManager.disconnect();
    idMappingManager = null;
  }
};

export default IDMappingManager;