import { Prisma, students, students_grade_category } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { BaseRepository } from './base.repository';

/**
 * Students Repository
 * 
 * Extends BaseRepository to provide student-specific operations with flexible
 * ID handling for student_id (external student identifier).
 */
export class StudentsRepository extends BaseRepository<
  students,
  Prisma.studentsCreateInput,
  Prisma.studentsUpdateInput
> {
  constructor() {
    super(prisma, 'students', 'student_id');
  }

  /**
   * Find a student by student_id
   */
  async findByStudentId(student_id: string): Promise<students | null> {
    try {
      const student = await this.getModel().findUnique({
        where: { student_id },
        include: {
          book_checkouts: {
            where: { status: 'ACTIVE' },
            orderBy: { checkout_date: 'desc' },
            take: 5,
          },
          fines: {
            where: { status: 'UNPAID' },
            orderBy: { created_at: 'desc' },
            take: 5,
          },
        },
      });

      return student;
    } catch (error) {
      this.handleDatabaseError(error, 'findByStudentId', { student_id });
    }
  }

  /**
   * Find students by grade level
   */
  async findByGradeLevel(grade_level: string): Promise<students[]> {
    try {
      const students = await this.getModel().findMany({
        where: { grade_level },
        orderBy: { last_name: 'asc' },
      });

      return students;
    } catch (error) {
      this.handleDatabaseError(error, 'findByGradeLevel', { grade_level });
    }
  }

  /**
   * Find students by section
   */
  async findBySection(section: string): Promise<students[]> {
    try {
      const students = await this.getModel().findMany({
        where: { section },
        orderBy: { last_name: 'asc' },
      });

      return students;
    } catch (error) {
      this.handleDatabaseError(error, 'findBySection', { section });
    }
  }

  /**
   * Find students by grade category
   */
  async findByGradeCategory(grade_category: students_grade_category): Promise<students[]> {
    try {
      const students = await this.getModel().findMany({
        where: { grade_category },
        orderBy: { grade_level: 'asc', last_name: 'asc' },
      });

      return students;
    } catch (error) {
      this.handleDatabaseError(error, 'findByGradeCategory', { grade_category });
    }
  }

  /**
   * Create a new student with automatic field population
   */
  async createStudent(data: {
    student_id: string;
    first_name: string;
    last_name: string;
    grade_level: string;
    section: string;
    grade_category?: students_grade_category;
    email?: string;
    phone?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
    notes?: string;
  }): Promise<students> {
    try {
      // Auto-determine grade category if not provided
      let grade_category = data.grade_category;
      if (!grade_category) {
        const gradeNumber = parseInt(data.grade_level.replace(/[^0-9]/g, ''), 10);
        if (gradeNumber >= 7 && gradeNumber <= 10) {
          grade_category = students_grade_category.JUNIOR_HIGH;
        } else if (gradeNumber >= 11 && gradeNumber <= 12) {
          grade_category = students_grade_category.SENIOR_HIGH;
        } else {
          throw new Error(`Invalid grade level: ${data.grade_level}`);
        }
      }

      const processedData = this.populateMissingFields({
        student_id: data.student_id.trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        grade_level: data.grade_level.trim(),
        section: data.section.trim(),
        grade_category,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        emergency_contact: data.emergency_contact?.trim() || null,
        emergency_phone: data.emergency_phone?.trim() || null,
        notes: data.notes?.trim() || null,
        is_active: true,
        total_checkouts: 0,
        active_checkouts: 0,
        total_fines: 0,
        unpaid_fines: 0,
      });

      const student = await this.getModel().create({
        data: processedData,
      });

      logger.info('Student created successfully', {
        id: student.id,
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        grade_level: student.grade_level,
        section: student.section,
      });

      return student;
    } catch (error) {
      // Handle unique constraint violation for student_id
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as any)?.find((field: string) => 
          field.includes('student_id')
        );
        
        if (target) {
          throw new Error(`Student with student_id '${data.student_id}' already exists`);
        }
      }

      this.handleDatabaseError(error, 'createStudent', {
        student_id: data.student_id,
        name: `${data.first_name} ${data.last_name}`,
      });
    }
  }

  /**
   * Upsert a student by student_id (ideal for imports)
   */
  async upsertByStudentId(
    student_id: string,
    data: {
      first_name: string;
      last_name: string;
      grade_level: string;
      section: string;
      grade_category?: students_grade_category;
      email?: string;
      phone?: string;
      address?: string;
      emergency_contact?: string;
      emergency_phone?: string;
      notes?: string;
      is_active?: boolean;
    }
  ): Promise<students> {
    try {
      const whereClause = { student_id };

      // Auto-determine grade category if not provided
      let grade_category = data.grade_category;
      if (!grade_category) {
        const gradeNumber = parseInt(data.grade_level.replace(/[^0-9]/g, ''), 10);
        if (gradeNumber >= 7 && gradeNumber <= 10) {
          grade_category = students_grade_category.JUNIOR_HIGH;
        } else if (gradeNumber >= 11 && gradeNumber <= 12) {
          grade_category = students_grade_category.SENIOR_HIGH;
        }
      }

      const createData = this.populateMissingFields({
        student_id: student_id.trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        grade_level: data.grade_level.trim(),
        section: data.section.trim(),
        grade_category,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        emergency_contact: data.emergency_contact?.trim() || null,
        emergency_phone: data.emergency_phone?.trim() || null,
        notes: data.notes?.trim() || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        total_checkouts: 0,
        active_checkouts: 0,
        total_fines: 0,
        unpaid_fines: 0,
      });

      const updateData = {
        ...(data.first_name && { first_name: data.first_name.trim() }),
        ...(data.last_name && { last_name: data.last_name.trim() }),
        ...(data.grade_level && { grade_level: data.grade_level.trim() }),
        ...(data.section && { section: data.section.trim() }),
        ...(grade_category && { grade_category }),
        ...(data.email !== undefined && { email: data.email?.trim() || null }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.address !== undefined && { address: data.address?.trim() || null }),
        ...(data.emergency_contact !== undefined && { emergency_contact: data.emergency_contact?.trim() || null }),
        ...(data.emergency_phone !== undefined && { emergency_phone: data.emergency_phone?.trim() || null }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        updated_at: new Date(),
      };

      const student = await this.getModel().upsert({
        where: whereClause,
        create: createData,
        update: updateData,
      });

      const isCreated = student.created_at.getTime() === student.updated_at.getTime();
      
      logger.info(`Student ${isCreated ? 'created' : 'updated'} successfully via upsert`, {
        id: student.id,
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        action: isCreated ? 'created' : 'updated',
      });

      return student;
    } catch (error) {
      this.handleDatabaseError(error, 'upsertByStudentId', {
        student_id,
        name: `${data.first_name} ${data.last_name}`,
      });
    }
  }

  /**
   * Get students with flexible filtering options
   */
  async getStudents(options: {
    grade_level?: string;
    section?: string;
    grade_category?: students_grade_category;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'first_name' | 'last_name' | 'grade_level' | 'section' | 'student_id' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    students: students[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        grade_level,
        section,
        grade_category,
        isActive,
        page = 1,
        limit = 50,
        search,
        sortBy = 'last_name',
        sortOrder = 'asc',
      } = options;

      const skip = (page - 1) * limit;
      const where: Prisma.studentsWhereInput = {};

      // Apply filters
      if (grade_level) {
        where.grade_level = { contains: grade_level, mode: 'insensitive' };
      }

      if (section) {
        where.section = { contains: section, mode: 'insensitive' };
      }

      if (grade_category) {
        where.grade_category = grade_category;
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      // Apply search across multiple fields
      if (search) {
        where.OR = [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { student_id: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [students, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.getModel().count({ where }),
      ]);

      return {
        students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getStudents', options);
    }
  }

  /**
   * Search students by multiple criteria with advanced filtering
   */
  async searchStudents(criteria: {
    query?: string;
    grade_level?: string;
    section?: string;
    grade_category?: students_grade_category;
    hasActiveCheckouts?: boolean;
    hasUnpaidFines?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'first_name' | 'last_name' | 'grade_level' | 'section' | 'student_id' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    students: students[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        query,
        grade_level,
        section,
        grade_category,
        hasActiveCheckouts,
        hasUnpaidFines,
        page = 1,
        limit = 50,
        sortBy = 'last_name',
        sortOrder = 'asc',
      } = criteria;

      const skip = (page - 1) * limit;
      const where: Prisma.studentsWhereInput = {};

      // Build search conditions
      const andConditions: Prisma.studentsWhereInput[] = [];

      if (query) {
        andConditions.push({
          OR: [
            { first_name: { contains: query, mode: 'insensitive' } },
            { last_name: { contains: query, mode: 'insensitive' } },
            { student_id: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        });
      }

      if (grade_level) {
        andConditions.push({
          grade_level: { contains: grade_level, mode: 'insensitive' }
        });
      }

      if (section) {
        andConditions.push({
          section: { contains: section, mode: 'insensitive' }
        });
      }

      if (grade_category) {
        andConditions.push({
          grade_category: grade_category
        });
      }

      if (hasActiveCheckouts !== undefined) {
        andConditions.push({
          active_checkouts: hasActiveCheckouts ? { gt: 0 } : 0
        });
      }

      if (hasUnpaidFines !== undefined) {
        andConditions.push({
          unpaid_fines: hasUnpaidFines ? { gt: 0 } : 0
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      const [students, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        this.getModel().count({ where }),
      ]);

      return {
        students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, 'searchStudents', criteria);
    }
  }

  /**
   * Update student checkout statistics
   */
  async updateCheckoutStats(
    student_id: string,
    change: {
      total?: number;
      active?: number;
    }
  ): Promise<students | null> {
    try {
      const updateData: Prisma.studentsUpdateInput = {
        updated_at: new Date(),
      };

      if (change.total !== undefined) {
        updateData.total_checkouts = {
          increment: change.total,
        };
      }

      if (change.active !== undefined) {
        updateData.active_checkouts = {
          increment: change.active,
        };
      }

      const student = await this.getModel().update({
        where: { student_id },
        data: updateData,
      });

      logger.info(`Student checkout stats updated`, {
        student_id,
        change,
        new_total: student.total_checkouts,
        new_active: student.active_checkouts,
      });

      return student;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update stats for non-existent student`, { student_id });
        return null;
      }

      this.handleDatabaseError(error, 'updateCheckoutStats', { student_id, change });
    }
  }

  /**
   * Update student fine statistics
   */
  async updateFineStats(
    student_id: string,
    change: {
      total?: number;
      unpaid?: number;
    }
  ): Promise<students | null> {
    try {
      const updateData: Prisma.studentsUpdateInput = {
        updated_at: new Date(),
      };

      if (change.total !== undefined) {
        updateData.total_fines = {
          increment: change.total,
        };
      }

      if (change.unpaid !== undefined) {
        updateData.unpaid_fines = {
          increment: change.unpaid,
        };
      }

      const student = await this.getModel().update({
        where: { student_id },
        data: updateData,
      });

      logger.info(`Student fine stats updated`, {
        student_id,
        change,
        new_total: student.total_fines,
        new_unpaid: student.unpaid_fines,
      });

      return student;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn(`Attempted to update stats for non-existent student`, { student_id });
        return null;
      }

      this.handleDatabaseError(error, 'updateFineStats', { student_id, change });
    }
  }

  /**
   * Get grade levels with counts
   */
  async getGradeLevelsWithCounts(): Promise<{ grade_level: string; count: number }[]> {
    try {
      const result = await this.getModel().groupBy({
        by: ['grade_level'],
        _count: {
          grade_level: true,
        },
        orderBy: {
          grade_level: 'asc',
        },
      });

      return result.map(item => ({
        grade_level: item.grade_level,
        count: item._count.grade_level,
      }));
    } catch (error) {
      this.handleDatabaseError(error, 'getGradeLevelsWithCounts');
    }
  }

  /**
   * Get sections with counts
   */
  async getSectionsWithCounts(): Promise<{ section: string; count: number }[]> {
    try {
      const result = await this.getModel().groupBy({
        by: ['section'],
        _count: {
          section: true,
        },
        orderBy: {
          section: 'asc',
        },
      });

      return result.map(item => ({
        section: item.section,
        count: item._count.section,
      }));
    } catch (error) {
      this.handleDatabaseError(error, 'getSectionsWithCounts');
    }
  }

  /**
   * Bulk upsert students (ideal for imports)
   */
  async bulkUpsertStudents(
    studentsData: Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      grade_level: string;
      section: string;
      grade_category?: students_grade_category;
      email?: string;
      phone?: string;
      address?: string;
      emergency_contact?: string;
      emergency_phone?: string;
      notes?: string;
    }>
  ): Promise<{
    created: number;
    updated: number;
    errors: Array<{ student_id: string; error: string }>;
  }> {
    const result = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ student_id: string; error: string }>,
    };

    for (const studentData of studentsData) {
      try {
        const student = await this.upsertByStudentId(studentData.student_id, studentData);
        
        // Check if it was created or updated by comparing timestamps
        if (student.created_at.getTime() === student.updated_at.getTime()) {
          result.created++;
        } else {
          result.updated++;
        }
      } catch (error) {
        result.errors.push({
          student_id: studentData.student_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Bulk student upsert completed', {
      total: studentsData.length,
      created: result.created,
      updated: result.updated,
      errors: result.errors.length,
    });

    return result;
  }

  /**
   * Validate student data
   */
  private validateStudentData(data: any): void {
    if (!data.student_id || typeof data.student_id !== 'string') {
      throw new Error('Student ID is required and must be a string');
    }

    if (!data.first_name || typeof data.first_name !== 'string') {
      throw new Error('First name is required and must be a string');
    }

    if (!data.last_name || typeof data.last_name !== 'string') {
      throw new Error('Last name is required and must be a string');
    }

    if (!data.grade_level || typeof data.grade_level !== 'string') {
      throw new Error('Grade level is required and must be a string');
    }

    if (!data.section || typeof data.section !== 'string') {
      throw new Error('Section is required and must be a string');
    }

    // Validate grade category if provided
    if (data.grade_category && !Object.values(students_grade_category).includes(data.grade_category)) {
      throw new Error(`Invalid grade category: ${data.grade_category}`);
    }
  }

  /**
   * Create a student (overriding base method for validation)
   */
  async create(data: Prisma.studentsCreateInput): Promise<students> {
    this.validateStudentData(data);
    return super.create(data);
  }

  /**
   * Update a student by ID (overriding base method for validation)
   */
  async updateById(id: string, data: Prisma.studentsUpdateInput): Promise<students | null> {
    // Validate only if student_id, first_name, last_name, grade_level, or section is being updated
    if (data.student_id || data.first_name || data.last_name || data.grade_level || data.section) {
      const existingStudent = await this.findById(id);
      if (!existingStudent) {
        return null;
      }

      const updatedData = { ...existingStudent, ...data };
      this.validateStudentData(updatedData);
    }

    return super.updateById(id, data);
  }

  /**
   * Update a student by external ID (overriding base method for validation)
   */
  async updateByExternalId(student_id: string, data: Prisma.studentsUpdateInput): Promise<students | null> {
    // Validate only if student_id, first_name, last_name, grade_level, or section is being updated
    if (data.student_id || data.first_name || data.last_name || data.grade_level || data.section) {
      const existingStudent = await this.findByStudentId(student_id);
      if (!existingStudent) {
        return null;
      }

      const updatedData = { ...existingStudent, ...data };
      this.validateStudentData(updatedData);
    }

    return super.updateByExternalId(student_id, data);
  }
}

// Create and export singleton instance
export const studentsRepository = new StudentsRepository();
export default studentsRepository;