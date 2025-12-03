/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export interface CreateStudentData {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: number;
  grade_category?: string;
  section?: string;
  gender?: string;
  is_active?: boolean;
  barcode?: string;
}

export interface UpdateStudentData {
  first_name?: string;
  last_name?: string;
  grade_level?: number;
  grade_category?: string;
  section?: string;
  gender?: string;
  is_active?: boolean;
  barcode?: string;
}

export class StudentService {
  public static async createStudent(data: CreateStudentData): Promise<any> {
    try {
      logger.info('Creating student', {
        student_id: data.student_id,
        name: `${data.first_name} ${data.last_name}`,
      });

      const student = await prisma.students.create({
        data: {
          student_id: data.student_id,
          first_name: data.first_name,
          last_name: data.last_name,
          grade_level: data.grade_level,
          grade_category: data.grade_category,
          section: data.section ?? null,
          gender: data.gender ?? null,
          is_active: data.is_active !== undefined ? data.is_active : true,
          barcode: data.barcode || data.student_id, // Default to student_id if not provided
        },
      });

      logger.info('Student created successfully', {
        student_id: student.student_id,
      });

      return student;
    } catch (error) {
      logger.error('Student creation failed', {
        student_id: data.student_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getStudentById(id: string): Promise<any> {
    try {
      const student = await prisma.students.findUnique({
        where: { id },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      return student;
    } catch (error) {
      logger.error('Get student by ID failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async updateStudent(
    id: string,
    data: UpdateStudentData,
  ): Promise<any> {
    try {
      logger.info('Updating student', { id });

      const student = await prisma.students.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });

      logger.info('Student updated successfully', { id });
      return student;
    } catch (error) {
      logger.error('Student update failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async deleteStudent(id: string): Promise<void> {
    try {
      logger.info('Deleting student', { id });

      // Delete in proper order to avoid foreign key constraint violations
      // First delete all related records
      await prisma.student_activities.deleteMany({
        where: { student_id: id },
      });

      await prisma.book_checkouts.deleteMany({
        where: { student_id: id },
      });

      // Finally delete the student
      await prisma.students.delete({ where: { id } });
      logger.info('Student deleted successfully', { id });
    } catch (error) {
      logger.error('Student deletion failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listStudents(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      gradeLevel?: number;
      section?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{ students: any[]; total: number; page: number; limit: number }> {
    try {
      const {
        page: rawPage = 1,
        limit: rawLimit = 50,
        search,
        gradeLevel,
        section,
        isActive,
      } = filters;

      // Parse page and limit as integers
      const page =
        typeof rawPage === 'string' ? parseInt(rawPage, 10) : rawPage;
      const limit =
        typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : rawLimit;

      // Build where clause
      const where: any = {};

      if (search) {
        // SQLite case-insensitive search: use lowercase contains
        const searchLower = search.toLowerCase();
        where.OR = [
          { first_name: { contains: searchLower } },
          { last_name: { contains: searchLower } },
          { student_id: { contains: searchLower } },
          { section: { contains: searchLower } },
        ];
      }

      if (gradeLevel !== undefined) {
        where.grade_level = gradeLevel;
      }

      if (section) {
        // SQLite case-insensitive search
        where.section = { contains: section.toLowerCase() };
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await prisma.students.count({ where });

      // Get paginated students with active loan count
      const studentsRaw = await prisma.students.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              checkouts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      });

      const students = studentsRaw.map(s => ({
        ...s,
        current_loans: (s as any)._count.checkouts,
        max_loans: 3, // Hardcoded default for now, could be dynamic later
        can_borrow: (s as any)._count.checkouts < 3,
      }));

      return {
        students,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('List students failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
