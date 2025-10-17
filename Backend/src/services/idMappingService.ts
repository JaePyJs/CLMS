import { 
  IDMappingManager, 
  EntityType, 
  MappingDirection, 
  IDMappingConfig,
  getIDMappingManager,
  BulkMappingResult,
  MappingStats,
  ValidationResult
} from '../utils/idMappingSystem';
import { logger } from '../utils/logger';
import { performanceLogger } from '../utils/logger';

/**
 * Service wrapper for ID mapping system with additional business logic
 * Provides integration points for repositories, controllers, and import services
 */
export class IDMappingService {
  private manager: IDMappingManager | null = null;
  private initialized = false;

  constructor(config?: IDMappingConfig) {
    this.initialize(config);
  }

  /**
   * Initialize the ID mapping service
   */
  async initialize(config?: IDMappingConfig): Promise<void> {
    if (this.initialized) {
      logger.warn('IDMappingService already initialized');
      return;
    }

    try {
      this.manager = await getIDMappingManager(config);
      this.initialized = true;
      logger.info('IDMappingService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize IDMappingService', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create or update a student ID mapping
   */
  async createStudentMapping(studentId: string, internalId: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();
    await this.manager!.createMapping(EntityType.STUDENT, studentId, internalId, metadata);
    logger.info('Student mapping created', { studentId, internalId });
  }

  /**
   * Create or update a book ID mapping
   */
  async createBookMapping(accessionNo: string, internalId: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();
    await this.manager!.createMapping(EntityType.BOOK, accessionNo, internalId, metadata);
    logger.info('Book mapping created', { accessionNo, internalId });
  }

  /**
   * Create or update an equipment ID mapping
   */
  async createEquipmentMapping(equipmentId: string, internalId: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();
    await this.manager!.createMapping(EntityType.EQUIPMENT, equipmentId, internalId, metadata);
    logger.info('Equipment mapping created', { equipmentId, internalId });
  }

  /**
   * Create or update a user ID mapping
   */
  async createUserMapping(username: string, internalId: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();
    await this.manager!.createMapping(EntityType.USER, username, internalId, metadata);
    logger.info('User mapping created', { username, internalId });
  }

  /**
   * Create or update a checkout ID mapping
   */
  async createCheckoutMapping(checkoutId: string, internalId: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();
    await this.manager!.createMapping(EntityType.CHECKOUT, checkoutId, internalId, metadata);
    logger.info('Checkout mapping created', { checkoutId, internalId });
  }

  /**
   * Get internal UUID for student
   */
  async getStudentInternalId(studentId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getInternalId(EntityType.STUDENT, studentId);
  }

  /**
   * Get external student ID from internal UUID
   */
  async getStudentExternalId(internalId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getExternalId(EntityType.STUDENT, internalId);
  }

  /**
   * Get internal UUID for book
   */
  async getBookInternalId(accessionNo: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getInternalId(EntityType.BOOK, accessionNo);
  }

  /**
   * Get external accession number from internal UUID
   */
  async getBookExternalId(internalId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getExternalId(EntityType.BOOK, internalId);
  }

  /**
   * Get internal UUID for equipment
   */
  async getEquipmentInternalId(equipmentId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getInternalId(EntityType.EQUIPMENT, equipmentId);
  }

  /**
   * Get external equipment ID from internal UUID
   */
  async getEquipmentExternalId(internalId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getExternalId(EntityType.EQUIPMENT, internalId);
  }

  /**
   * Get internal UUID for user
   */
  async getUserInternalId(username: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getInternalId(EntityType.USER, username);
  }

  /**
   * Get external username from internal UUID
   */
  async getUserExternalId(internalId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getExternalId(EntityType.USER, internalId);
  }

  /**
   * Get internal UUID for checkout
   */
  async getCheckoutInternalId(checkoutId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getInternalId(EntityType.CHECKOUT, checkoutId);
  }

  /**
   * Get external checkout ID from internal UUID
   */
  async getCheckoutExternalId(internalId: string): Promise<string | null> {
    this.ensureInitialized();
    return await this.manager!.getExternalId(EntityType.CHECKOUT, internalId);
  }

  /**
   * Bulk create student mappings (for import scenarios)
   */
  async bulkCreateStudentMappings(
    mappings: Array<{ studentId: string; internalId: string; metadata?: Record<string, any> }>
  ): Promise<BulkMappingResult> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('bulk_create_student_mappings', { count: mappings.length });

    try {
      const formattedMappings = mappings.map(m => ({
        externalId: m.studentId,
        internalId: m.internalId,
        metadata: m.metadata
      }));

      const result = await this.manager!.bulkCreateMappings(EntityType.STUDENT, formattedMappings);
      
      performanceLogger.end('bulk_create_student_mappings', startTime, { 
        success: result.success, 
        failed: result.failed 
      });

      logger.info('Bulk student mappings created', {
        total: mappings.length,
        success: result.success,
        failed: result.failed
      });

      return result;
    } catch (error) {
      performanceLogger.end('bulk_create_student_mappings', startTime, { success: false });
      logger.error('Failed to bulk create student mappings', {
        count: mappings.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Bulk create book mappings (for import scenarios)
   */
  async bulkCreateBookMappings(
    mappings: Array<{ accessionNo: string; internalId: string; metadata?: Record<string, any> }>
  ): Promise<BulkMappingResult> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('bulk_create_book_mappings', { count: mappings.length });

    try {
      const formattedMappings = mappings.map(m => ({
        externalId: m.accessionNo,
        internalId: m.internalId,
        metadata: m.metadata
      }));

      const result = await this.manager!.bulkCreateMappings(EntityType.BOOK, formattedMappings);
      
      performanceLogger.end('bulk_create_book_mappings', startTime, { 
        success: result.success, 
        failed: result.failed 
      });

      logger.info('Bulk book mappings created', {
        total: mappings.length,
        success: result.success,
        failed: result.failed
      });

      return result;
    } catch (error) {
      performanceLogger.end('bulk_create_book_mappings', startTime, { success: false });
      logger.error('Failed to bulk create book mappings', {
        count: mappings.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Bulk create equipment mappings (for import scenarios)
   */
  async bulkCreateEquipmentMappings(
    mappings: Array<{ equipmentId: string; internalId: string; metadata?: Record<string, any> }>
  ): Promise<BulkMappingResult> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('bulk_create_equipment_mappings', { count: mappings.length });

    try {
      const formattedMappings = mappings.map(m => ({
        externalId: m.equipmentId,
        internalId: m.internalId,
        metadata: m.metadata
      }));

      const result = await this.manager!.bulkCreateMappings(EntityType.EQUIPMENT, formattedMappings);
      
      performanceLogger.end('bulk_create_equipment_mappings', startTime, { 
        success: result.success, 
        failed: result.failed 
      });

      logger.info('Bulk equipment mappings created', {
        total: mappings.length,
        success: result.success,
        failed: result.failed
      });

      return result;
    } catch (error) {
      performanceLogger.end('bulk_create_equipment_mappings', startTime, { success: false });
      logger.error('Failed to bulk create equipment mappings', {
        count: mappings.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get mapping statistics for all entity types
   */
  async getAllMappingStats(): Promise<Record<EntityType, MappingStats>> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('get_all_mapping_stats');

    try {
      const statsPromises = Object.values(EntityType).map(entityType => 
        this.manager!.getMappingStats(entityType)
      );

      const statsResults = await Promise.all(statsPromises);
      const statsMap: Record<EntityType, MappingStats> = {} as Record<EntityType, MappingStats>;

      Object.values(EntityType).forEach((entityType, index) => {
        statsMap[entityType] = statsResults[index];
      });

      performanceLogger.end('get_all_mapping_stats', startTime);
      return statsMap;
    } catch (error) {
      performanceLogger.end('get_all_mapping_stats', startTime, { success: false });
      logger.error('Failed to get all mapping stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate mappings for all entity types
   */
  async validateAllMappings(): Promise<Record<EntityType, ValidationResult>> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('validate_all_mappings');

    try {
      const validationPromises = Object.values(EntityType).map(entityType => 
        this.manager!.validateMappings(entityType)
      );

      const validationResults = await Promise.all(validationPromises);
      const validationMap: Record<EntityType, ValidationResult> = {} as Record<EntityType, ValidationResult>;

      Object.values(EntityType).forEach((entityType, index) => {
        validationMap[entityType] = validationResults[index];
      });

      performanceLogger.end('validate_all_mappings', startTime);
      return validationMap;
    } catch (error) {
      performanceLogger.end('validate_all_mappings', startTime, { success: false });
      logger.error('Failed to validate all mappings', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clean up stale mappings for all entity types
   */
  async cleanupAllStaleMappings(olderThan: Date): Promise<Record<EntityType, number>> {
    this.ensureInitialized();
    const startTime = performanceLogger.start('cleanup_all_stale_mappings', { 
      olderThan: olderThan.toISOString() 
    });

    try {
      const cleanupPromises = Object.values(EntityType).map(entityType => 
        this.manager!.cleanupStaleMappings(entityType, olderThan)
      );

      const cleanupResults = await Promise.all(cleanupPromises);
      const cleanupMap: Record<EntityType, number> = {} as Record<EntityType, number>;

      Object.values(EntityType).forEach((entityType, index) => {
        cleanupMap[entityType] = cleanupResults[index];
      });

      performanceLogger.end('cleanup_all_stale_mappings', startTime);
      return cleanupMap;
    } catch (error) {
      performanceLogger.end('cleanup_all_stale_mappings', startTime, { success: false });
      logger.error('Failed to cleanup all stale mappings', {
        olderThan: olderThan.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get health status of the ID mapping system
   */
  async getHealthStatus(): Promise<{
    isInitialized: boolean;
    entityTypes: EntityType[];
    totalMappings: number;
    lastValidation?: Date;
  }> {
    try {
      if (!this.initialized || !this.manager) {
        return {
          isInitialized: false,
          entityTypes: [],
          totalMappings: 0
        };
      }

      const stats = await this.getAllMappingStats();
      const totalMappings = Object.values(stats).reduce((sum, stat) => sum + stat.totalMappings, 0);

      return {
        isInitialized: true,
        entityTypes: Object.values(EntityType),
        totalMappings
      };
    } catch (error) {
      logger.error('Failed to get health status', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        isInitialized: false,
        entityTypes: [],
        totalMappings: 0
      };
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.manager) {
      throw new Error('IDMappingService is not initialized. Call initialize() first.');
    }
  }

  /**
   * Disconnect the service
   */
  async disconnect(): Promise<void> {
    if (this.manager) {
      await this.manager.disconnect();
      this.manager = null;
    }
    this.initialized = false;
    logger.info('IDMappingService disconnected');
  }
}

// Export singleton instance
let idMappingService: IDMappingService | null = null;

/**
 * Get or create the ID mapping service singleton
 */
export const getIDMappingService = async (config?: IDMappingConfig): Promise<IDMappingService> => {
  if (!idMappingService) {
    idMappingService = new IDMappingService(config);
  }
  return idMappingService;
};

/**
 * Disconnect the ID mapping service
 */
export const disconnectIDMappingService = async (): Promise<void> => {
  if (idMappingService) {
    await idMappingService.disconnect();
    idMappingService = null;
  }
};

export default IDMappingService;