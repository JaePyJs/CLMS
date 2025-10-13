import { describe, it, expect, beforeEach } from 'vitest'
import { prisma, generateTestStudentId } from '../setup-simple'
import {
  createStudent,
  getStudents,
  getStudentById,
  getStudentByBarcode,
  updateStudent,
  deleteStudent
} from '@/services/studentService'
import { students_grade_category } from '@prisma/client'

describe('Students Service Integration Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.students.deleteMany()
  })

  describe('getStudents', () => {
    it('should return an empty array when no students exist', async () => {
      const result = await getStudents()
      expect(result.students).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should return all students', async () => {
      // Create test students
      await prisma.students.createMany({
        data: [
          {
            student_id: '2023001',
            first_name: 'John',
            last_name: 'Doe',
            grade_level: 'Grade 7',
            grade_category: students_grade_category.JUNIOR_HIGH,
            section: '7-A'
          },
          {
            student_id: '2023002',
            first_name: 'Jane',
            last_name: 'Smith',
            grade_level: 'Grade 8',
            grade_category: students_grade_category.JUNIOR_HIGH,
            section: '8-B'
          }
        ]
      })

      const result = await getStudents()
      expect(result.students).toHaveLength(2)
      expect(result.total).toBe(2)
    })
  })

  describe('createStudent', () => {
    it('should create a new student', async () => {
      const student_id = generateTestStudentId('api-create')
      const studentData = {
        student_id,
        first_name: 'John',
        last_name: 'Doe',
        grade_level: 'Grade 7',
        grade_category: students_grade_category.JUNIOR_HIGH,
        section: '7-A'
      }

      const student = await createStudent(studentData)

      expect(student).toBeDefined()
      expect(student.student_id).toBe(studentData.student_id)
      expect(student.first_name).toBe(studentData.first_name)
      expect(student.last_name).toBe(studentData.last_name)
    })

    it('should throw error for duplicate student ID', async () => {
      const student_id = generateTestStudentId('api-duplicate')
      const studentData = {
        student_id,
        first_name: 'John',
        last_name: 'Doe',
        grade_level: 'Grade 7',
        grade_category: students_grade_category.JUNIOR_HIGH,
        section: '7-A'
      }

      // Create first student
      await createStudent(studentData)

      // Try to create duplicate
      await expect(createStudent(studentData)).rejects.toThrow()
    })
  })

  describe('getStudentById', () => {
    it('should return a student by ID', async () => {
      // Create test student
      const student_id = generateTestStudentId('api-byid')
      const createdStudent = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id,
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 7',
          grade_category: students_grade_category.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const student = await getStudentById(createdStudent.id)
      expect(student).toBeDefined()
      expect(student?.id).toBe(createdStudent.id)
      expect(student?.student_id).toBe(student_id)
    })

    it('should return null for non-existent student', async () => {
      const student = await getStudentById('non-existent-id')
      expect(student).toBeNull()
    })
  })

  describe('updateStudent', () => {
    it('should update a student', async () => {
      // Create test student
      const student_id = generateTestStudentId('api-update')
      const createdStudent = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id,
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 7',
          grade_category: students_grade_category.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const updateData = {
        first_name: 'Johnathan',
        section: '7-B'
      }

      const updatedStudent = await updateStudent(createdStudent.id, updateData)
      expect(updatedStudent).toBeDefined()
      expect(updatedStudent?.first_name).toBe(updateData.first_name)
      expect(updatedStudent?.section).toBe(updateData.section)
    })

    it('should return null for non-existent student', async () => {
      const updatedStudent = await updateStudent('non-existent-id', { first_name: 'John' })
      expect(updatedStudent).toBeNull()
    })
  })

  describe('deleteStudent', () => {
    it('should delete a student', async () => {
      // Create test student
      const student_id = generateTestStudentId('api-delete')
      const createdStudent = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id,
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 7',
          grade_category: students_grade_category.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const deletedStudent = await deleteStudent(createdStudent.id)
      expect(deletedStudent).toBeDefined()
      expect(deletedStudent?.id).toBe(createdStudent.id)

      // Verify student is deleted
      const student = await prisma.students.findUnique({
        where: { id: createdStudent.id }
      })
      expect(student).toBeNull()
    })

    it('should return null for non-existent student', async () => {
      const deletedStudent = await deleteStudent('non-existent-id')
      expect(deletedStudent).toBeNull()
    })
  })

  describe('getStudentByBarcode', () => {
    it('should return a student by barcode (student ID)', async () => {
      // Create test student
      const student_id = generateTestStudentId('api-barcode')
      await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id,
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 7',
          grade_category: students_grade_category.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const student = await getStudentByBarcode(student_id)
      expect(student).toBeDefined()
      expect(student?.student_id).toBe(student_id)
    })

    it('should return null for non-existent barcode', async () => {
      const student = await getStudentByBarcode('non-existent-barcode')
      expect(student).toBeNull()
    })
  })
})