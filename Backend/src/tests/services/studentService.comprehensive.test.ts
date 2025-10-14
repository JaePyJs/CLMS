import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Student, StudentActivity } from '@prisma/client';
import {
  getDefaultTimeLimit,
  getStudentByBarcode,
  getStudentById,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentActivities,
  getActiveSessions,
  createStudentActivity,
  endStudentActivity,
  type GetStudentsOptions,
  type GetStudentActivitiesOptions
} from '@/services/studentService';
import { TestDataFactory, GRADE_CATEGORIES, TIME_LIMITS, ACTIVITY_TYPES, ACTIVITY_STATUS } from '../factories/TestDataFactory';
import { performanceOptimizationService } from '@/services/performanceOptimizationService';
import { logger } from '@/utils/logger';

// Mock dependencies
vi.mock('@/services/performanceOptimizationService');
vi.mock('@/utils/logger');
vi.mock('@/utils/prisma');

const mockPerformanceOptimizationService = vi.mocked(performanceOptimizationService);
const mockLogger = vi.mocked(logger);

describe('Student Service - Comprehensive Tests', () => {
  let testStudents: Student[];
  let testActivities: StudentActivity[];

  beforeEach(() => {
    TestDataFactory.resetCounter();
    testStudents = TestDataFactory.createStudents(5);
    testActivities = TestDataFactory.createStudentActivities(10);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDefaultTimeLimit', () => {
    it('should return correct time limits for each grade category', () => {
      expect(getDefaultTimeLimit('PRIMARY')).toBe(30);
      expect(getDefaultTimeLimit('GRADE_SCHOOL')).toBe(60);
      expect(getDefaultTimeLimit('JUNIOR_HIGH')).toBe(90);
      expect(getDefaultTimeLimit('SENIOR_HIGH')).toBe(120);
    });

    it('should return default time limit for unknown grade categories', () => {
      // @ts-expect-error - Testing unknown grade category
      expect(getDefaultTimeLimit('UNKNOWN')).toBe(60);
    });

    it('should use environment variables when available', () => {
      const originalEnv = process.env;

      process.env = {
        ...originalEnv,
        PRIMARY_TIME_LIMIT: '45',
        GRADE_SCHOOL_TIME_LIMIT: '75',
        JUNIOR_HIGH_TIME_LIMIT: '105',
        SENIOR_HIGH_TIME_LIMIT: '135'
      };

      expect(getDefaultTimeLimit('PRIMARY')).toBe(45);
      expect(getDefaultTimeLimit('GRADE_SCHOOL')).toBe(75);
      expect(getDefaultTimeLimit('JUNIOR_HIGH')).toBe(105);
      expect(getDefaultTimeLimit('SENIOR_HIGH')).toBe(135);

      process.env = originalEnv;
    });
  });

  describe('getStudentByBarcode', () => {
    it('should return student with default time limit when found', async () => {
      const mockStudent = testStudents[0];
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        ...mockStudent,
        defaultTimeLimit: TIME_LIMITS[mockStudent.grade_category as keyof typeof TIME_LIMITS],
        hasActiveSession: false
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudentByBarcode(mockStudent.student_id);

      expect(mockPerformanceOptimizationService.executeQuery).toHaveBeenCalledWith(
        'student_by_barcode',
        expect.any(Function),
        expect.objectContaining({
          key: `student:barcode:${mockStudent.student_id}`,
          ttl: 300,
          tags: ['student', 'barcode']
        })
      );

      expect(result).toEqual({
        ...mockStudent,
        defaultTimeLimit: TIME_LIMITS[mockStudent.grade_category as keyof typeof TIME_LIMITS],
        hasActiveSession: false
      });
    });

    it('should return null when student not found', async () => {
      const mockExecuteQuery = vi.fn().mockResolvedValue(null);
      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudentByBarcode('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockExecuteQuery = vi.fn().mockRejectedValue(new Error('Database error'));
      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      await expect(getStudentByBarcode('TEST123')).rejects.toThrow('Database error');
    });
  });

  describe('getStudentById', () => {
    it('should return student with default time limit when found', async () => {
      const mockStudent = testStudents[0];
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        ...mockStudent,
        defaultTimeLimit: TIME_LIMITS[mockStudent.grade_category as keyof typeof TIME_LIMITS],
        hasActiveSession: true
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudentById(mockStudent.id);

      expect(mockPerformanceOptimizationService.executeQuery).toHaveBeenCalledWith(
        'student_by_id',
        expect.any(Function),
        expect.objectContaining({
          key: `student:id:${mockStudent.id}`,
          ttl: 300,
          tags: ['student']
        })
      );

      expect(result).toEqual({
        ...mockStudent,
        defaultTimeLimit: TIME_LIMITS[mockStudent.grade_category as keyof typeof TIME_LIMITS],
        hasActiveSession: true
      });
    });

    it('should return null when student not found', async () => {
      const mockExecuteQuery = vi.fn().mockResolvedValue(null);
      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudentById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getStudents', () => {
    it('should return paginated students with no filters', async () => {
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: testStudents,
        total: testStudents.length,
        pagination: {
          page: 1,
          limit: 50,
          total: testStudents.length,
          pages: Math.ceil(testStudents.length / 50)
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudents();

      expect(result).toHaveProperty('students');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('pagination');
      expect(result.students).toEqual(testStudents);
      expect(result.total).toBe(testStudents.length);
    });

    it('should filter by grade category', async () => {
      const grade7Students = testStudents.filter(s => s.grade_category === 'GRADE_7');
      const options: GetStudentsOptions = { gradeCategory: 'GRADE_7' };

      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: grade7Students,
        total: grade7Students.length,
        pagination: {
          page: 1,
          limit: 50,
          total: grade7Students.length,
          pages: Math.ceil(grade7Students.length / 50)
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudents(options);

      expect(result.students).toEqual(grade7Students);
      expect(result.total).toBe(grade7Students.length);
    });

    it('should filter by active status', async () => {
      const activeStudents = testStudents.filter(s => s.is_active);
      const options: GetStudentsOptions = { isActive: true };

      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: activeStudents,
        total: activeStudents.length,
        pagination: {
          page: 1,
          limit: 50,
          total: activeStudents.length,
          pages: Math.ceil(activeStudents.length / 50)
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudents(options);

      expect(result.students).toEqual(activeStudents);
      expect(result.total).toBe(activeStudents.length);
    });

    it('should handle pagination correctly', async () => {
      const page = 2;
      const limit = 2;
      const options: GetStudentsOptions = { page, limit };

      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: testStudents.slice(2, 4),
        total: testStudents.length,
        pagination: {
          page,
          limit,
          total: testStudents.length,
          pages: Math.ceil(testStudents.length / limit)
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudents(options);

      expect(result.students).toHaveLength(2);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(2);
    });

    it('should handle multiple filters combined', async () => {
      const filteredStudents = testStudents.filter(s =>
        s.grade_category === 'GRADE_7' && s.is_active
      );
      const options: GetStudentsOptions = {
        gradeCategory: 'GRADE_7',
        isActive: true
      };

      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: filteredStudents,
        total: filteredStudents.length,
        pagination: {
          page: 1,
          limit: 50,
          total: filteredStudents.length,
          pages: Math.ceil(filteredStudents.length / 50)
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const result = await getStudents(options);

      expect(result.students).toEqual(filteredStudents);
    });
  });

  describe('createStudent', () => {
    it('should create a new student successfully', async () => {
      const newStudentData = {
        student_id: '2023001',
        first_name: 'John',
        last_name: 'Doe',
        grade_level: 'Grade 7',
        grade_category: 'GRADE_7',
        section: '7-A'
      };

      const expectedStudent = {
        ...newStudentData,
        id: 'new-student-id',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        barcode: newStudentData.student_id
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.prisma.students.create).mockResolvedValue(expectedStudent as any);

      const result = await createStudent(newStudentData);

      expect(result).toEqual(expectedStudent);
      expect(mockLogger.info).toHaveBeenCalledWith('Student created successfully', {
        student_id: newStudentData.student_id
      });
    });

    it('should throw error when student ID already exists', async () => {
      const existingStudent = testStudents[0];
      const duplicateData = {
        student_id: existingStudent.student_id,
        first_name: 'Jane',
        last_name: 'Smith',
        grade_level: 'Grade 8',
        grade_category: 'GRADE_8',
        section: '8-B'
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(existingStudent);

      await expect(createStudent(duplicateData)).rejects.toThrow('Student ID already exists');
      expect(mockLogger.warn).toHaveBeenCalledWith('Attempted to create duplicate student', {
        student_id: duplicateData.student_id
      });
    });

    it('should handle database errors during creation', async () => {
      const newStudentData = {
        student_id: '2023002',
        first_name: 'Jane',
        last_name: 'Smith',
        grade_level: 'Grade 8',
        grade_category: 'GRADE_8',
        section: '8-B'
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockRejectedValue(new Error('Database error'));

      await expect(createStudent(newStudentData)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating student', {
        error: 'Database error',
        data: newStudentData
      });
    });
  });

  describe('updateStudent', () => {
    it('should update student by database ID', async () => {
      const existingStudent = testStudents[0];
      const updateData = {
        firstName: 'Johnathan',
        lastName: 'Doe Updated',
        gradeLevel: 'Grade 8',
        gradeCategory: 'GRADE_8' as const,
        section: '8-B',
        isActive: true
      };

      const updatedStudent = { ...existingStudent, ...updateData };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(existingStudent);
      vi.mocked(mockPrisma.prisma.students.update).mockResolvedValue(updatedStudent as any);

      const result = await updateStudent(existingStudent.id, updateData);

      expect(result).toEqual(updatedStudent);
      expect(mockLogger.info).toHaveBeenCalledWith('Student updated successfully', {
        identifier: existingStudent.id
      });
    });

    it('should update student by student_id', async () => {
      const existingStudent = testStudents[0];
      const updateData = {
        firstName: 'Johnathan',
        lastName: 'Doe Updated'
      };

      const updatedStudent = { ...existingStudent, ...updateData };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(existingStudent);
      vi.mocked(mockPrisma.prisma.students.update).mockResolvedValue(updatedStudent as any);

      const result = await updateStudent(existingStudent.student_id, updateData);

      expect(result).toEqual(updatedStudent);
    });

    it('should return null when student not found', async () => {
      const updateData = { firstName: 'Johnathan' };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(null);

      const result = await updateStudent('nonexistent-id', updateData);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Attempted to update non-existent student', {
        identifier: 'nonexistent-id'
      });
    });

    it('should handle Prisma record not found error', async () => {
      const updateData = { firstName: 'Johnathan' };

      const mockPrisma = await import('@/utils/prisma');
      const prismaError = new Error('Record not found') as any;
      prismaError.code = 'P2025';
      prismaError.constructor = { name: 'PrismaClientKnownRequestError' };

      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(testStudents[0]);
      vi.mocked(mockPrisma.prisma.students.update).mockRejectedValue(prismaError);

      const result = await updateStudent(testStudents[0].id, updateData);

      expect(result).toBeNull();
    });
  });

  describe('deleteStudent', () => {
    it('should delete student by database ID', async () => {
      const existingStudent = testStudents[0];

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(existingStudent);
      vi.mocked(mockPrisma.prisma.students.delete).mockResolvedValue(existingStudent as any);

      const result = await deleteStudent(existingStudent.id);

      expect(result).toEqual(existingStudent);
      expect(mockLogger.info).toHaveBeenCalledWith('Student deleted successfully', {
        identifier: existingStudent.id
      });
    });

    it('should delete student by student_id', async () => {
      const existingStudent = testStudents[0];

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(existingStudent);
      vi.mocked(mockPrisma.prisma.students.delete).mockResolvedValue(existingStudent as any);

      const result = await deleteStudent(existingStudent.student_id);

      expect(result).toEqual(existingStudent);
    });

    it('should return null when student not found', async () => {
      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(null);

      const result = await deleteStudent('nonexistent-id');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Attempted to delete non-existent student', {
        identifier: 'nonexistent-id'
      });
    });
  });

  describe('getStudentActivities', () => {
    it('should return activities with pagination', async () => {
      const options: GetStudentActivitiesOptions = { page: 1, limit: 10 };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue(testActivities as any);
      vi.mocked(mockPrisma.prisma.student_activities.count).mockResolvedValue(testActivities.length);

      const result = await getStudentActivities(options);

      expect(result).toHaveProperty('activities');
      expect(result).toHaveProperty('pagination');
      expect(result.activities).toEqual(testActivities);
      expect(result.pagination.total).toBe(testActivities.length);
    });

    it('should filter by student_id', async () => {
      const studentActivities = testActivities.slice(0, 3);
      const options: GetStudentActivitiesOptions = { student_id: 'student-1' };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue(studentActivities as any);
      vi.mocked(mockPrisma.prisma.student_activities.count).mockResolvedValue(studentActivities.length);

      const result = await getStudentActivities(options);

      expect(result.activities).toEqual(studentActivities);
      expect(result.pagination.total).toBe(studentActivities.length);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const options: GetStudentActivitiesOptions = { startDate, endDate };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue(testActivities as any);
      vi.mocked(mockPrisma.prisma.student_activities.count).mockResolvedValue(testActivities.length);

      const result = await getStudentActivities(options);

      expect(result.activities).toEqual(testActivities);
    });

    it('should filter by activity type', async () => {
      const checkInActivities = testActivities.filter(a => a.activity_type === 'CHECK_IN');
      const options: GetStudentActivitiesOptions = { activityType: 'CHECK_IN' };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue(checkInActivities as any);
      vi.mocked(mockPrisma.prisma.student_activities.count).mockResolvedValue(checkInActivities.length);

      const result = await getStudentActivities(options);

      expect(result.activities).toEqual(checkInActivities);
    });

    it('should handle database errors', async () => {
      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockRejectedValue(new Error('Database error'));

      await expect(getStudentActivities()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching student activities', {
        error: 'Database error',
        options: {}
      });
    });
  });

  describe('getActiveSessions', () => {
    it('should return active student sessions', async () => {
      const activeActivities = testActivities.filter(a => a.status === 'ACTIVE');

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue(activeActivities as any);

      const result = await getActiveSessions();

      expect(result).toEqual(activeActivities);
    });

    it('should handle empty active sessions', async () => {
      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockResolvedValue([]);

      const result = await getActiveSessions();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.findMany).mockRejectedValue(new Error('Database error'));

      await expect(getActiveSessions()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching active sessions', {
        error: 'Database error'
      });
    });
  });

  describe('createStudentActivity', () => {
    it('should create new student activity', async () => {
      const student = testStudents[0];
      const activityData = {
        student_id: student.student_id,
        activity_type: 'CHECK_IN' as const,
        equipment_id: 'equipment-1',
        timeLimitMinutes: 60,
        notes: 'Test activity'
      };

      const expectedActivity = {
        id: 'activity-1',
        student_id: student.id,
        activity_type: activityData.activity_type,
        equipment_id: activityData.equipment_id,
        start_time: expect.any(Date),
        end_time: expect.any(Date),
        time_limit_minutes: activityData.timeLimitMinutes,
        notes: activityData.notes,
        status: 'ACTIVE',
        student: {
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          grade_level: student.grade_level,
          grade_category: student.grade_category
        }
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(student as any);
      vi.mocked(mockPrisma.prisma.student_activities.create).mockResolvedValue(expectedActivity as any);

      const result = await createStudentActivity(activityData);

      expect(result).toEqual(expectedActivity);
      expect(mockLogger.info).toHaveBeenCalledWith('Student activity created successfully', {
        activityId: expectedActivity.id,
        student_id: student.student_id,
        activity_type: activityData.activity_type
      });
    });

    it('should use default time limit from grade category', async () => {
      const student = testStudents[0];
      const activityData = {
        student_id: student.student_id,
        activity_type: 'CHECK_IN' as const
      };

      const expectedActivity = {
        id: 'activity-1',
        time_limit_minutes: TIME_LIMITS[student.grade_category as keyof typeof TIME_LIMITS]
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(student as any);
      vi.mocked(mockPrisma.prisma.student_activities.create).mockResolvedValue(expectedActivity as any);

      await createStudentActivity(activityData);

      expect(mockPrisma.prisma.student_activities.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            time_limit_minutes: TIME_LIMITS[student.grade_category as keyof typeof TIME_LIMITS]
          })
        })
      );
    });

    it('should throw error when student not found', async () => {
      const activityData = {
        student_id: 'nonexistent-student',
        activity_type: 'CHECK_IN' as const
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(null);

      await expect(createStudentActivity(activityData)).rejects.toThrow('Student not found');
    });

    it('should handle database errors', async () => {
      const student = testStudents[0];
      const activityData = {
        student_id: student.student_id,
        activity_type: 'CHECK_IN' as const
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValue(student as any);
      vi.mocked(mockPrisma.prisma.student_activities.create).mockRejectedValue(new Error('Database error'));

      await expect(createStudentActivity(activityData)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating student activity', {
        error: 'Database error',
        data: activityData
      });
    });
  });

  describe('endStudentActivity', () => {
    it('should end student activity and calculate duration', async () => {
      const activity = testActivities[0];
      const now = new Date();
      const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const updatedActivity = {
        ...activity,
        start_time: startTime,
        end_time: now,
        status: 'COMPLETED' as const,
        duration_minutes: 60
      };

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.update)
        .mockResolvedValueOnce({ ...activity, end_time: now, status: 'COMPLETED' } as any)
        .mockResolvedValueOnce(updatedActivity as any);

      const result = await endStudentActivity(activity.id);

      expect(result).toEqual({
        ...activity,
        end_time: now,
        status: 'COMPLETED'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Student activity ended successfully', {
        activityId: activity.id,
        student_id: activity.student_id
      });
    });

    it('should handle database errors', async () => {
      const activity = testActivities[0];

      const mockPrisma = await import('@/utils/prisma');
      vi.mocked(mockPrisma.prisma.student_activities.update).mockRejectedValue(new Error('Database error'));

      await expect(endStudentActivity(activity.id)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error ending student activity', {
        error: 'Database error',
        activityId: activity.id
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large student datasets efficiently', async () => {
      const largeStudentSet = TestDataFactory.createStudents(1000);
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        students: largeStudentSet,
        total: largeStudentSet.length,
        pagination: {
          page: 1,
          limit: 50,
          total: largeStudentSet.length,
          pages: 20
        }
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const { result, duration } = await measurePerformance(
        () => getStudents({ page: 1, limit: 50 }),
        'Get 1000 students'
      );

      expect(result.students).toHaveLength(50);
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should cache frequently accessed students', async () => {
      const student = testStudents[0];
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        ...student,
        defaultTimeLimit: TIME_LIMITS[student.grade_category as keyof typeof TIME_LIMITS],
        hasActiveSession: false
      });

      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      // First call
      await getStudentByBarcode(student.student_id);
      // Second call (should use cache)
      await getStudentByBarcode(student.student_id);

      expect(mockPerformanceOptimizationService.executeQuery).toHaveBeenCalledTimes(2);
      expect(mockPerformanceOptimizationService.executeQuery).toHaveBeenCalledWith(
        'student_by_barcode',
        expect.any(Function),
        expect.objectContaining({
          key: `student:barcode:${student.student_id}`,
          ttl: 300
        })
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete student lifecycle', async () => {
      const newStudentData = {
        student_id: '2023999',
        first_name: 'Integration',
        last_name: 'Test',
        grade_level: 'Grade 10',
        grade_category: 'GRADE_10' as const,
        section: '10-A'
      };

      const createdStudent = { ...newStudentData, id: 'integration-student-id' };
      const updatedStudent = { ...createdStudent, first_name: 'Integration Updated' };

      const mockPrisma = await import('@/utils/prisma');

      // Create
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValueOnce(null);
      vi.mocked(mockPrisma.prisma.students.create).mockResolvedValueOnce(createdStudent as any);

      const created = await createStudent(newStudentData);
      expect(created).toEqual(createdStudent);

      // Update
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValueOnce(createdStudent);
      vi.mocked(mockPrisma.prisma.students.update).mockResolvedValueOnce(updatedStudent as any);

      const updated = await updateStudent(createdStudent.id, { firstName: 'Integration Updated' });
      expect(updated.first_name).toBe('Integration Updated');

      // Read
      const mockExecuteQuery = vi.fn().mockResolvedValue({
        ...updatedStudent,
        defaultTimeLimit: TIME_LIMITS[updatedStudent.grade_category],
        hasActiveSession: false
      });
      mockPerformanceOptimizationService.executeQuery.mockReturnValue(mockExecuteQuery());

      const read = await getStudentById(updatedStudent.id);
      expect(read.first_name).toBe('Integration Updated');

      // Delete
      vi.mocked(mockPrisma.prisma.students.findUnique).mockResolvedValueOnce(updatedStudent);
      vi.mocked(mockPrisma.prisma.students.delete).mockResolvedValueOnce(updatedStudent as any);

      const deleted = await deleteStudent(updatedStudent.id);
      expect(deleted.id).toBe(updatedStudent.id);
    });
  });
});