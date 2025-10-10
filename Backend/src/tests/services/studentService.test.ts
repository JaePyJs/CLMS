import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../setup'
import { 
  createStudent, 
  getStudents, 
  getStudentById, 
  getStudentByBarcode, 
  updateStudent, 
  deleteStudent,
  getActiveSessions,
  createStudentActivity,
  endStudentActivity
} from '@/services/studentService'
import { GradeCategory, ActivityType, ActivityStatus } from '@prisma/client'

describe('Student Service', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.student.deleteMany()
    await prisma.activity.deleteMany()
  })

  describe('createStudent', () => {
    it('should create a new student', async () => {
      const studentData = {
        studentId: '2023001',
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
      expect(student.gradeLevel).toBe(studentData.gradeLevel)
      expect(student.gradeCategory).toBe(studentData.gradeCategory)
      expect(student.section).toBe(studentData.section)
      expect(student.isActive).toBe(true)
    })

    it('should throw an error if student ID already exists', async () => {
      const studentData = {
        studentId: '2023001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: GradeCategory.JUNIOR_HIGH,
        section: '7-A'
      }

      // Create first student
      await createStudent(studentData)

      // Try to create student with same ID
      await expect(createStudent(studentData)).rejects.toThrow()
    })
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

    it('should filter students by grade category', async () => {
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
            gradeLevel: 'Grade 1',
            gradeCategory: GradeCategory.PRIMARY,
            section: '1-A'
          }
        ]
      })

      const result = await getStudents({ gradeCategory: GradeCategory.JUNIOR_HIGH })
      expect(result.students).toHaveLength(1)
      expect(result.students[0].gradeCategory).toBe(GradeCategory.JUNIOR_HIGH)
    })
  })

  describe('getStudentById', () => {
    it('should return a student by ID', async () => {
      // Create test student
      const createdStudent = await prisma.student.create({
        data: {
          studentId: '2023001',
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
      expect(student?.studentId).toBe('2023001')
    })

    it('should return null for non-existent student', async () => {
      const student = await getStudentById('non-existent-id')
      expect(student).toBeNull()
    })
  })

  describe('getStudentByBarcode', () => {
    it('should return a student by barcode (student ID)', async () => {
      // Create test student
      await prisma.student.create({
        data: {
          studentId: '2023001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const student = await getStudentByBarcode('2023001')
      expect(student).toBeDefined()
      expect(student?.studentId).toBe('2023001')
    })

    it('should return null for non-existent barcode', async () => {
      const student = await getStudentByBarcode('non-existent-barcode')
      expect(student).toBeNull()
    })
  })

  describe('updateStudent', () => {
    it('should update a student', async () => {
      // Create test student
      const createdStudent = await prisma.student.create({
        data: {
          studentId: '2023001',
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
      const createdStudent = await prisma.student.create({
        data: {
          studentId: '2023001',
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

  describe('Student Activities', () => {
    it('should create a student activity', async () => {
      // Create test student
      const student = await prisma.student.create({
        data: {
          studentId: '2023001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      const activityData = {
        studentId: student.studentId,
        activityType: ActivityType.STUDY,
        notes: 'Test activity'
      }

      const activity = await createStudentActivity(activityData)
      expect(activity).toBeDefined()
      expect(activity.studentId).toBe(student.studentId)
      expect(activity.activityType).toBe(activityData.activityType)
      expect(activity.status).toBe(ActivityStatus.ACTIVE)
    })

    it('should get active sessions', async () => {
      // Create test student
      const student = await prisma.student.create({
        data: {
          studentId: '2023001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      // Create active activity
      await createStudentActivity({
        studentId: student.studentId,
        activityType: ActivityType.STUDY
      })

      const activeSessions = await getActiveSessions()
      expect(activeSessions).toHaveLength(1)
      expect(activeSessions[0].student.studentId).toBe(student.studentId)
      expect(activeSessions[0].status).toBe(ActivityStatus.ACTIVE)
    })

    it('should end a student activity', async () => {
      // Create test student
      const student = await prisma.student.create({
        data: {
          studentId: '2023001',
          firstName: 'John',
          lastName: 'Doe',
          gradeLevel: 'Grade 7',
          gradeCategory: GradeCategory.JUNIOR_HIGH,
          section: '7-A'
        }
      })

      // Create active activity
      const activity = await createStudentActivity({
        studentId: student.studentId,
        activityType: ActivityType.STUDY
      })

      // End the activity
      const endedActivity = await endStudentActivity(activity.id)
      expect(endedActivity).toBeDefined()
      expect(endedActivity?.status).toBe(ActivityStatus.COMPLETED)
      expect(endedActivity?.endTime).toBeDefined()
    })
  })
})