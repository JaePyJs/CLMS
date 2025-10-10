import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import supertest from 'supertest'
import { app } from '@/app'
import { prisma } from '../setup'
import { GradeCategory } from '@prisma/client'

describe('Students API', () => {
  let authToken: string

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.student.deleteMany()

    // For now, we'll skip authentication and test without it
    // In a real implementation, you would create a test user and get auth token
    authToken = 'mock-token'
  })

  afterEach(async () => {
    // Clean up database after each test
    await prisma.student.deleteMany()
  })

  describe('GET /api/students', () => {
    it('should return an empty array when no students exist', async () => {
      const response = await supertest(app.getApp())
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.students).toHaveLength(0)
      expect(response.body.data.total).toBe(0)
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

      const response = await supertest(app.getApp())
        .get('/api/students')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.students).toHaveLength(2)
      expect(response.body.data.total).toBe(2)
    })

    it('should return 401 when not authenticated', async () => {
      const response = await supertest(app.getApp())
        .get('/api/students')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/students', () => {
    it('should create a new student', async () => {
      const studentData = {
        studentId: '2023001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: GradeCategory.JUNIOR_HIGH,
        section: '7-A'
      }

      const response = await supertest(app.getApp())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.student.studentId).toBe(studentData.studentId)
      expect(response.body.data.student.firstName).toBe(studentData.firstName)
      expect(response.body.data.student.lastName).toBe(studentData.lastName)
    })

    it('should return 400 when required fields are missing', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe'
        // Missing required fields
      }

      const response = await supertest(app.getApp())
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      const studentData = {
        studentId: '2023001',
        firstName: 'John',
        lastName: 'Doe',
        gradeLevel: 'Grade 7',
        gradeCategory: GradeCategory.JUNIOR_HIGH,
        section: '7-A'
      }

      const response = await supertest(app.getApp())
        .post('/api/students')
        .send(studentData)

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/students/:id', () => {
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

      const response = await supertest(app.getApp())
        .get(`/api/students/${createdStudent.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.student.id).toBe(createdStudent.id)
      expect(response.body.data.student.studentId).toBe('2023001')
    })

    it('should return 404 for non-existent student', async () => {
      const response = await supertest(app.getApp())
        .get('/api/students/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      const response = await supertest(app.getApp())
        .get('/api/students/some-id')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('PUT /api/students/:id', () => {
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

      const response = await supertest(app.getApp())
        .put(`/api/students/${createdStudent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.student.firstName).toBe(updateData.firstName)
      expect(response.body.data.student.section).toBe(updateData.section)
    })

    it('should return 404 for non-existent student', async () => {
      const updateData = {
        firstName: 'Johnathan'
      }

      const response = await supertest(app.getApp())
        .put('/api/students/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      const updateData = {
        firstName: 'Johnathan'
      }

      const response = await supertest(app.getApp())
        .put('/api/students/some-id')
        .send(updateData)

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/students/:id', () => {
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

      const response = await supertest(app.getApp())
        .delete(`/api/students/${createdStudent.id}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.student.id).toBe(createdStudent.id)

      // Verify student is deleted
      const student = await prisma.student.findUnique({
        where: { id: createdStudent.id }
      })
      expect(student).toBeNull()
    })

    it('should return 404 for non-existent student', async () => {
      const response = await supertest(app.getApp())
        .delete('/api/students/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    it('should return 401 when not authenticated', async () => {
      const response = await supertest(app.getApp())
        .delete('/api/students/some-id')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})