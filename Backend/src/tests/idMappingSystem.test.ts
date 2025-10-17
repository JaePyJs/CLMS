import { 
  IDMappingManager, 
  EntityType, 
  MappingDirection,
  IDMappingConfig 
} from '../utils/idMappingSystem';
import { IDMappingService } from '../services/idMappingService';
import { prisma } from '../utils/prisma';

// Mock dependencies
jest.mock('../utils/prisma');
jest.mock('../utils/redis');
jest.mock('../utils/logger');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('IDMappingSystem', () => {
  let manager: IDMappingManager;
  let service: IDMappingService;
  const testConfig: IDMappingConfig = {
    redisKeyPrefix: 'test:mapping:',
    defaultTTL: 60000, // 1 minute for tests
    enableAnalytics: true,
    enableValidation: true,
    cleanupInterval: 0, // Disable auto-cleanup for tests
    batchSize: 10,
    enableMetrics: true
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Prisma operations
    mockPrisma.idMapping.create.mockResolvedValue({
      id: 'test-mapping-id',
      entityType: 'student',
      externalId: '20230187',
      internalId: 'test-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      isActive: true,
      metadata: null
    });

    mockPrisma.idMapping.findFirst.mockResolvedValue({
      id: 'test-mapping-id',
      entityType: 'student',
      externalId: '20230187',
      internalId: 'test-uuid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      isActive: true,
      metadata: null
    });

    mockPrisma.idMapping.updateMany.mockResolvedValue({ count: 1 });

    // Initialize manager and service
    manager = new IDMappingManager(testConfig);
    await manager.initialize();
    
    service = new IDMappingService(testConfig);
    await service.initialize();
  });

  afterEach(async () => {
    await manager.disconnect();
    await service.disconnect();
  });

  describe('IDMappingManager', () => {
    describe('createMapping', () => {
      it('should create a new mapping successfully', async () => {
        const mapping = await manager.createMapping(
          EntityType.STUDENT,
          '20230187',
          'test-uuid-1',
          { source: 'test' }
        );

        expect(mapping).toEqual({
          id: 'test-mapping-id',
          entityType: EntityType.STUDENT,
          externalId: '20230187',
          internalId: 'test-uuid-1',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          lastAccessed: expect.any(Date),
          accessCount: 0,
          isActive: true,
          metadata: { source: 'test' }
        });

        expect(mockPrisma.idMapping.create).toHaveBeenCalledWith({
          data: {
            entityType: EntityType.STUDENT,
            externalId: '20230187',
            internalId: 'test-uuid-1',
            metadata: JSON.stringify({ source: 'test' }),
            isActive: true,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            lastAccessed: expect.any(Date),
            accessCount: 0
          }
        });
      });

      it('should throw error for invalid entity type', async () => {
        await expect(
          manager.createMapping('invalid' as EntityType, 'test', 'test')
        ).rejects.toThrow('Invalid entity type: invalid');
      });

      it('should throw error for empty external ID', async () => {
        await expect(
          manager.createMapping(EntityType.STUDENT, '', 'test-uuid')
        ).rejects.toThrow('External ID cannot be empty');
      });

      it('should throw error for empty internal ID', async () => {
        await expect(
          manager.createMapping(EntityType.STUDENT, '20230187', '')
        ).rejects.toThrow('Internal ID cannot be empty');
      });
    });

    describe('getInternalId', () => {
      it('should return internal ID for valid external ID', async () => {
        const internalId = await manager.getInternalId(EntityType.STUDENT, '20230187');
        expect(internalId).toBe('test-uuid-1');
      });

      it('should return null for non-existent external ID', async () => {
        mockPrisma.idMapping.findFirst.mockResolvedValue(null);
        const internalId = await manager.getInternalId(EntityType.STUDENT, 'nonexistent');
        expect(internalId).toBeNull();
      });
    });

    describe('getExternalId', () => {
      it('should return external ID for valid internal ID', async () => {
        const externalId = await manager.getExternalId(EntityType.STUDENT, 'test-uuid-1');
        expect(externalId).toBe('20230187');
      });

      it('should return null for non-existent internal ID', async () => {
        mockPrisma.idMapping.findFirst.mockResolvedValue(null);
        const externalId = await manager.getExternalId(EntityType.STUDENT, 'nonexistent-uuid');
        expect(externalId).toBeNull();
      });
    });

    describe('bulkCreateMappings', () => {
      it('should create multiple mappings successfully', async () => {
        const mappings = [
          { externalId: '20230187', internalId: 'uuid-1' },
          { externalId: '20230188', internalId: 'uuid-2' },
          { externalId: '20230189', internalId: 'uuid-3' }
        ];

        mockPrisma.idMapping.create.mockResolvedValue({
          id: 'test-mapping-id',
          entityType: 'student',
          externalId: '20230187',
          internalId: 'uuid-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          isActive: true,
          metadata: null
        });

        const result = await manager.bulkCreateMappings(EntityType.STUDENT, mappings);

        expect(result.success).toBe(3);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(result.duration).toBeGreaterThan(0);
      });

      it('should handle partial failures in bulk operations', async () => {
        const mappings = [
          { externalId: '20230187', internalId: 'uuid-1' },
          { externalId: '20230188', internalId: 'uuid-2' }
        ];

        mockPrisma.idMapping.create
          .mockResolvedValueOnce({
            id: 'test-mapping-id-1',
            entityType: 'student',
            externalId: '20230187',
            internalId: 'uuid-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0,
            isActive: true,
            metadata: null
          })
          .mockRejectedValueOnce(new Error('Database error'));

        const result = await manager.bulkCreateMappings(EntityType.STUDENT, mappings);

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          externalId: '20230188',
          error: 'Database error'
        });
      });
    });

    describe('getMappingStats', () => {
      it('should return mapping statistics', async () => {
        mockPrisma.idMapping.groupBy.mockResolvedValue([
          {
            isActive: true,
            _count: { id: 100 },
            _avg: { accessCount: 5.5 },
            _max: { lastAccessed: new Date(), createdAt: new Date() }
          }
        ]);

        mockPrisma.idMapping.findMany.mockResolvedValue([
          {
            externalId: '20230187',
            internalId: 'uuid-1',
            accessCount: 10
          }
        ]);

        mockPrisma.idMapping.count.mockResolvedValue(5);

        const stats = await manager.getMappingStats(EntityType.STUDENT);

        expect(stats.entityType).toBe(EntityType.STUDENT);
        expect(stats.totalMappings).toBe(100);
        expect(stats.activeMappings).toBe(100);
        expect(stats.inactiveMappings).toBe(0);
        expect(stats.staleMappings).toBe(5);
        expect(stats.averageAccessCount).toBe(5.5);
        expect(stats.mostAccessedMappings).toHaveLength(1);
      });
    });

    describe('validateMappings', () => {
      it('should validate mappings successfully', async () => {
        const mockMappings = [
          {
            id: '1',
            entityType: 'student',
            externalId: '20230187',
            internalId: 'uuid-1',
            isActive: true
          },
          {
            id: '2',
            entityType: 'student',
            externalId: '20230188',
            internalId: 'uuid-2',
            isActive: true
          }
        ];

        mockPrisma.idMapping.findMany.mockResolvedValue(mockMappings);
        mockPrisma.student.findUnique.mockResolvedValue({ id: 'uuid-1' });

        const result = await manager.validateMappings(EntityType.STUDENT);

        expect(result.totalChecked).toBe(2);
        expect(result.validMappings).toBe(1);
        expect(result.invalidMappings).toBe(1);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].type).toBe('orphaned');
      });

      it('should detect duplicate external IDs', async () => {
        const mockMappings = [
          {
            id: '1',
            entityType: 'student',
            externalId: '20230187',
            internalId: 'uuid-1',
            isActive: true
          },
          {
            id: '2',
            entityType: 'student',
            externalId: '20230187', // Duplicate
            internalId: 'uuid-2',
            isActive: true
          }
        ];

        mockPrisma.idMapping.findMany.mockResolvedValue(mockMappings);
        mockPrisma.student.findUnique.mockResolvedValue({ id: 'uuid-1' });

        const result = await manager.validateMappings(EntityType.STUDENT);

        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].type).toBe('duplicate');
        expect(result.issues[0].externalId).toBe('20230187');
      });
    });

    describe('cleanupStaleMappings', () => {
      it('should cleanup stale mappings successfully', async () => {
        const olderThan = new Date();
        olderThan.setDate(olderThan.getDate() - 30);

        mockPrisma.idMapping.deleteMany.mockResolvedValue({ count: 5 });

        const deletedCount = await manager.cleanupStaleMappings(EntityType.STUDENT, olderThan);

        expect(deletedCount).toBe(5);
        expect(mockPrisma.idMapping.deleteMany).toHaveBeenCalledWith({
          where: {
            entityType: EntityType.STUDENT,
            lastAccessed: { lt: olderThan },
            isActive: true
          }
        });
      });
    });
  });

  describe('IDMappingService', () => {
    describe('entity-specific methods', () => {
      it('should create student mapping', async () => {
        await service.createStudentMapping('20230187', 'test-uuid-1', { source: 'test' });

        expect(mockPrisma.idMapping.create).toHaveBeenCalledWith({
          data: {
            entityType: EntityType.STUDENT,
            externalId: '20230187',
            internalId: 'test-uuid-1',
            metadata: JSON.stringify({ source: 'test' }),
            isActive: true,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            lastAccessed: expect.any(Date),
            accessCount: 0
          }
        });
      });

      it('should get student internal ID', async () => {
        const internalId = await service.getStudentInternalId('20230187');
        expect(internalId).toBe('test-uuid-1');
      });

      it('should get student external ID', async () => {
        const externalId = await service.getStudentExternalId('test-uuid-1');
        expect(externalId).toBe('20230187');
      });
    });

    describe('bulk operations', () => {
      it('should bulk create student mappings', async () => {
        const mappings = [
          { studentId: '20230187', internalId: 'uuid-1' },
          { studentId: '20230188', internalId: 'uuid-2' }
        ];

        mockPrisma.idMapping.create.mockResolvedValue({
          id: 'test-mapping-id',
          entityType: 'student',
          externalId: '20230187',
          internalId: 'uuid-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          isActive: true,
          metadata: null
        });

        const result = await service.bulkCreateStudentMappings(mappings);

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
      });
    });

    describe('analytics and validation', () => {
      it('should get all mapping stats', async () => {
        mockPrisma.idMapping.groupBy.mockResolvedValue([
          {
            isActive: true,
            _count: { id: 50 },
            _avg: { accessCount: 3.0 },
            _max: { lastAccessed: new Date(), createdAt: new Date() }
          }
        ]);

        mockPrisma.idMapping.findMany.mockResolvedValue([]);
        mockPrisma.idMapping.count.mockResolvedValue(0);

        const allStats = await service.getAllMappingStats();

        expect(Object.keys(allStats)).toContain(EntityType.STUDENT);
        expect(Object.keys(allStats)).toContain(EntityType.BOOK);
        expect(Object.keys(allStats)).toContain(EntityType.EQUIPMENT);
        expect(Object.keys(allStats)).toContain(EntityType.USER);
        expect(Object.keys(allStats)).toContain(EntityType.CHECKOUT);
      });

      it('should validate all mappings', async () => {
        mockPrisma.idMapping.findMany.mockResolvedValue([]);
        const validationResults = await service.validateAllMappings();

        expect(Object.keys(validationResults)).toContain(EntityType.STUDENT);
        expect(Object.keys(validationResults)).toContain(EntityType.BOOK);
        expect(Object.keys(validationResults)).toContain(EntityType.EQUIPMENT);
        expect(Object.keys(validationResults)).toContain(EntityType.USER);
        expect(Object.keys(validationResults)).toContain(EntityType.CHECKOUT);
      });
    });

    describe('health status', () => {
      it('should return health status', async () => {
        mockPrisma.idMapping.groupBy.mockResolvedValue([
          {
            isActive: true,
            _count: { id: 10 },
            _avg: { accessCount: 1.0 },
            _max: { lastAccessed: new Date(), createdAt: new Date() }
          }
        ]);

        mockPrisma.idMapping.findMany.mockResolvedValue([]);
        mockPrisma.idMapping.count.mockResolvedValue(0);

        const health = await service.getHealthStatus();

        expect(health.isInitialized).toBe(true);
        expect(health.entityTypes).toHaveLength(5);
        expect(health.totalMappings).toBe(50); // 10 mappings * 5 entity types
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.idMapping.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        manager.createMapping(EntityType.STUDENT, '20230187', 'test-uuid-1')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache failures gracefully', async () => {
      // Mock cache failure but database success
      mockPrisma.idMapping.findFirst.mockResolvedValue({
        id: 'test-mapping-id',
        entityType: 'student',
        externalId: '20230187',
        internalId: 'test-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        isActive: true,
        metadata: null
      });

      const internalId = await manager.getInternalId(EntityType.STUDENT, '20230187');
      expect(internalId).toBe('test-uuid-1');
    });
  });

  describe('Performance', () => {
    it('should handle large bulk operations efficiently', async () => {
      const largeMappingSet = Array.from({ length: 1000 }, (_, i) => ({
        externalId: `2023${i.toString().padStart(4, '0')}`,
        internalId: `uuid-${i}`
      }));

      mockPrisma.idMapping.create.mockResolvedValue({
        id: 'test-mapping-id',
        entityType: 'student',
        externalId: '20230187',
        internalId: 'uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        isActive: true,
        metadata: null
      });

      const startTime = Date.now();
      const result = await manager.bulkCreateMappings(EntityType.STUDENT, largeMappingSet);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(1000);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});