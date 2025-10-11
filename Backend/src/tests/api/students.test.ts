import { describe, it, expect, beforeEach } from 'vitest'
import { prisma, generateTestStudentId } from '../setup'
import {
  createStudent,
  getStudents,
  getStudentById,
  getStudentByBarcode,
  updateStudent,
  deleteStudent
} from '@/services/studentService'
import { GradeCategory } from '@prisma/client'

describe('Students Service Integration Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.student.deleteMany()
  })

  describe('getStudents', () => {
    it('should return an empty array when no students exist', async () => {
      const result = await getStudents()
      expect(result.students).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should return all students', async () => {
      // Create test students
      await prisma.student.createMany({
        data: [
          {
            studentId: '2023001',
            firstName: 'John',
            lastName: 'Doe',
            gradeLevel: 'Grade 7',
            gradeCategory: GradeCategory.JUNIOR_HIGH,
            section: '7-A'
          },
          {
            studentId: '2023002',
            firstName: 'Jane',
            lastName: 'Smith',
            gradeLevel: 'Grade 8',
            gradeCategory: GradeCategory.JUNIOR_HIGH,
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
      const studentId = generateTestStudentId('api-create')
      const studentData = {
        studentId,
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: GradeCategory.JUNIOR_HIGH,
        section: '7-A'
      }

      const student = await createStudent(studentData)

      expect(student).toBeDefined()
      expect(student.studentId).toBe(studentData.studentId)
      expect(student.firstName).toBe(studentData.firstName)
      expect(student.lastName).toBe(studentData.lastName)
    })

    it('should throw error for duplicate student ID', async () => {
      const studentId = generateTestStudentId('api-duplicate')
      const studentData = {
        studentId,
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: GradeCategory.JUNIOR_HIGH,
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
      const studentId = generateTestStudentId('api-byid')
      const createdStudent = await prisma.student.create({
        data: {
          studentId,
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const student = await getStudentById(createdStudent.id)
      expect(student).toBeDefined()
      expect(student?.id).toBe(createdStudent.id)
      expect(student?.studentId).toBe(studentId)
    })

    it('should return null for non-existent student', async () => {
      const student = await getStudentById('non-existent-id')
      expect(student).toBeNull()
    })
  })

  describe('updateStudent', () => {
    it('should update a student', async () => {
      // Create test student
      const studentId = generateTestStudentId('api-update')
      const createdStudent = await prisma.student.create({
        data: {
          studentId,
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const updateData = {
        firstName: 'Johnathan',
        section: '7-B'
      }

      const updatedStudent = await updateStudent(createdStudent.id, updateData)
      expect(updatedStudent).toBeDefined()
      expect(updatedStudent?.firstName).toBe(updateData.firstName)
      expect(updatedStudent?.section).toBe(updateData.section)
    })

    it('should return null for non-existent student', async () => {
      const updatedStudent = await updateStudent('non-existent-id', { firstName: 'John' })
      expect(updatedStudent).toBeNull()
    })
  })

  describe('deleteStudent', () => {
    it('should delete a student', async () => {
      // Create test student
      const studentId = generateTestStudentId('api-delete')
      const createdStudent = await prisma.student.create({
        data: {
          studentId,
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const deletedStudent = await deleteStudent(createdStudent.id)
      expect(deletedStudent).toBeDefined()
      expect(deletedStudent?.id).toBe(createdStudent.id)

      // Verify student is deleted
      const student = await prisma.student.findUnique({
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
      const studentId = generateTestStudentId('api-barcode')
      await prisma.student.create({
        data: {
          studentId,
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const student = await getStudentByBarcode(studentId)
      expect(student).toBeDefined()
      expect(student?.studentId).toBe(studentId)
    })

    it('should return null for non-existent barcode', async () => {
      const student = await getStudentByBarcode('non-existent-barcode')
      expect(student).toBeNull()
    })
  })
})