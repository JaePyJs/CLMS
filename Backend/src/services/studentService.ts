import { PrismaClient, students_grade_category } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateStudentData {
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  grade_category: students_grade_category;
  section?: string;
  is_active?: boolean;
}

export interface UpdateStudentData {
  first_name?: string;
  last_name?: string;
  grade_level?: string;
  grade_category?: students_grade_category;
  section?: string;
  is_active?: boolean;
}

export class StudentService {
  public static async createStudent(data: CreateStudentData): Promise<any> {
    try {
      logger.info('Creating student', {
        student_id: data.student_id,
        name: `${data.first_name} ${data.last_name}`
      });

      const student = await prisma.students.create({
        data: {
          student_id: data.student_id,
          first_name: data.first_name,
          last_name: data.last_name,
          grade_level: data.grade_level,
          grade_category: data.grade_category,
          section: data.section ?? null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });

      logger.info('Student created successfully', { 
        student_id: student.student_id 
      });

      return student;
    } catch (error) {
      logger.error('Student creation failed', {
        student_id: data.student_id,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      logger.error('Get student by ID failed', { id, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public static async updateStudent(id: string, data: UpdateStudentData): Promise<any> {
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
      logger.error('Student update failed', { id, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public static async deleteStudent(id: string): Promise<void> {
    try {
      logger.info('Deleting student', { id });
      await prisma.students.delete({ where: { id } });
      logger.info('Student deleted successfully', { id });
    } catch (error) {
      logger.error('Student deletion failed', { id, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  public static async listStudents(): Promise<any[]> {
    try {
      const students = await prisma.students.findMany({
        orderBy: { created_at: 'desc' },
      });
      return students;
    } catch (error) {
      logger.error('List students failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
}