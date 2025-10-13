import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../setup-simple'
import {
  createEquipment,
  getEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
  checkoutEquipment,
  returnEquipment,
  getEquipmentSessions,
  getEquipmentUsageStats
} from '@/services/equipmentService'
import { equipment_status, EquipmentCategory } from '@prisma/client'

describe('Equipment Service', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.equipment.deleteMany()
    await prisma.equipment_sessions.deleteMany()
    await prisma.students.deleteMany()
  })

  describe('createEquipment', () => {
    it('should create new equipment', async () => {
      const equipmentData = {
        name: 'Desktop Computer',
        category: EquipmentCategory.COMPUTER,
        description: 'High-performance desktop computer',
        location: 'Computer Lab 1',
        assetTag: 'EQ001'
      }

      const equipment = await createEquipment(equipmentData)

      expect(equipment).toBeDefined()
      expect(equipment.name).toBe(equipmentData.name)
      expect(equipment.category).toBe(equipmentData.category)
      expect(equipment.status).toBe(equipment_status.AVAILABLE)
      expect(equipment.assetTag).toBe(equipmentData.assetTag)
    })

    it('should throw an error if asset tag already exists', async () => {
      const equipmentData = {
        name: 'Desktop Computer',
        category: EquipmentCategory.COMPUTER,
        description: 'High-performance desktop computer',
        location: 'Computer Lab 1',
        assetTag: 'EQ001'
      }

      // Create first equipment
      await createEquipment(equipmentData)

      // Try to create equipment with same asset tag
      await expect(createEquipment(equipmentData)).rejects.toThrow()
    })
  })

  describe('getEquipment', () => {
    it('should return empty array when no equipment exists', async () => {
      const result = await getEquipment()
      expect(result.equipment).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should return all equipment', async () => {
      // Create test equipment
      await prisma.equipment.createMany({
        data: [
          {
            name: 'Computer 1',
            category: EquipmentCategory.COMPUTER,
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ001'
          },
          {
            name: 'Projector 1',
            category: EquipmentCategory.AUDIO_VISUAL,
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ002'
          }
        ]
      })

      const result = await getEquipment()
      expect(result.equipment).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('should filter equipment by category', async () => {
      // Create test equipment
      await prisma.equipment.createMany({
        data: [
          {
            name: 'Computer 1',
            category: EquipmentCategory.COMPUTER,
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ001'
          },
          {
            name: 'Projector 1',
            category: EquipmentCategory.AUDIO_VISUAL,
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ002'
          }
        ]
      })

      const result = await getEquipment({ category: EquipmentCategory.COMPUTER })
      expect(result.equipment).toHaveLength(1)
      expect(result.equipment[0].category).toBe(EquipmentCategory.COMPUTER)
    })

    it('should filter equipment by status', async () => {
      // Create test equipment
      await prisma.equipment.createMany({
        data: [
          {
            name: 'Computer 1',
            category: EquipmentCategory.COMPUTER,
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ001'
          },
          {
            name: 'Computer 2',
            category: EquipmentCategory.COMPUTER,
            status: equipment_status.IN_USE,
            assetTag: 'EQ002'
          }
        ]
      })

      const result = await getEquipment({ status: equipment_status.AVAILABLE })
      expect(result.equipment).toHaveLength(1)
      expect(result.equipment[0].status).toBe(equipment_status.AVAILABLE)
    })

    it('should search equipment by name or description', async () => {
      // Create test equipment
      await prisma.equipment.createMany({
        data: [
          {
            name: 'Laptop Computer',
            category: EquipmentCategory.COMPUTER,
            description: 'Portable laptop for student use',
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ001'
          },
          {
            name: 'Desktop Computer',
            category: EquipmentCategory.COMPUTER,
            description: 'Stationary desktop computer',
            status: equipment_status.AVAILABLE,
            assetTag: 'EQ002'
          }
        ]
      })

      const result = await getEquipment({ search: 'laptop' })
      expect(result.equipment).toHaveLength(1)
      expect(result.equipment[0].name).toBe('Laptop Computer')
    })
  })

  describe('getEquipmentById', () => {
    it('should return equipment by ID', async () => {
      // Create test equipment
      const createdEquipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      const equipment = await getEquipmentById(createdEquipment.id)
      expect(equipment).toBeDefined()
      expect(equipment?.id).toBe(createdEquipment.id)
      expect(equipment?.name).toBe('Test Computer')
    })

    it('should return null for non-existent equipment', async () => {
      const equipment = await getEquipmentById('non-existent-id')
      expect(equipment).toBeNull()
    })
  })

  describe('updateEquipment', () => {
    it('should update equipment', async () => {
      // Create test equipment
      const createdEquipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      const updateData = {
        name: 'Updated Computer Name',
        location: 'Updated Location'
      }

      const updatedEquipment = await updateEquipment(createdEquipment.id, updateData)
      expect(updatedEquipment).toBeDefined()
      expect(updatedEquipment?.name).toBe(updateData.name)
      expect(updatedEquipment?.location).toBe(updateData.location)
    })

    it('should return null for non-existent equipment', async () => {
      const updatedEquipment = await updateEquipment('non-existent-id', { name: 'Updated' })
      expect(updatedEquipment).toBeNull()
    })
  })

  describe('deleteEquipment', () => {
    it('should delete equipment', async () => {
      // Create test equipment
      const createdEquipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      const deletedEquipment = await deleteEquipment(createdEquipment.id)
      expect(deletedEquipment).toBeDefined()
      expect(deletedEquipment?.id).toBe(createdEquipment.id)

      // Verify equipment is deleted
      const equipment = await prisma.equipment.findUnique({
        where: { id: createdEquipment.id }
      })
      expect(equipment).toBeNull()
    })

    it('should return null for non-existent equipment', async () => {
      const deletedEquipment = await deleteEquipment('non-existent-id')
      expect(deletedEquipment).toBeNull()
    })
  })

  describe('checkoutEquipment', () => {
    it('should checkout equipment to a student', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      // Create test student
      const student = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id: 'STU001',
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 10',
          grade_category: 'SENIOR_HIGH',
          section: '10-A'
        }
      })

      const checkoutData = {
        equipment_id: equipment.id,
        student_id: student.student_id,
        purpose: 'Study session'
      }

      const session = await checkoutEquipment(checkoutData)
      expect(session).toBeDefined()
      expect(session.equipment_id).toBe(equipment.id)
      expect(session.student_id).toBe(student.id)
      expect(session.purpose).toBe('Study session')

      // Verify equipment status is updated
      const updatedEquipment = await prisma.equipment.findUnique({ where: { id: equipment.id } })
      expect(updatedEquipment?.status).toBe(equipment_status.IN_USE)
    })

    it('should throw error if equipment is not available', async () => {
      // Create test equipment that's already in use
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.IN_USE,
          assetTag: 'EQ001'
        }
      })

      const checkoutData = {
        equipment_id: equipment.id,
        student_id: 'STU001',
        purpose: 'Study session'
      }

      await expect(checkoutEquipment(checkoutData)).rejects.toThrow()
    })
  })

  describe('returnEquipment', () => {
    it('should return checked out equipment', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.IN_USE,
          assetTag: 'EQ001'
        }
      })

      // Create test student
      const student = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id: 'STU001',
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 10',
          grade_category: 'SENIOR_HIGH',
          section: '10-A'
        }
      })

      // Create active session
      const session = await prisma.equipment_sessions.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: equipment.id,
          student_id: student.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          purpose: 'Study session'
        }
      })

      const returnData = {
        sessionId: session.id,
        condition: 'Good',
        notes: 'Returned in working condition'
      }

      const endedSession = await returnEquipment(returnData)
      expect(endedSession).toBeDefined()
      expect(endedSession.id).toBe(session.id)
      expect(endedSession.end_time).toBeDefined()
      expect(endedSession.condition).toBe('Good')

      // Verify equipment status is updated
      const updatedEquipment = await prisma.equipment.findUnique({ where: { id: equipment.id } })
      expect(updatedEquipment?.status).toBe(equipment_status.AVAILABLE)
    })
  })

  describe('getEquipmentSessions', () => {
    it('should return active sessions for equipment', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.IN_USE,
          assetTag: 'EQ001'
        }
      })

      // Create test student
      const student = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id: 'STU001',
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 10',
          grade_category: 'SENIOR_HIGH',
          section: '10-A'
        }
      })

      // Create active session
      await prisma.equipment_sessions.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: equipment.id,
          student_id: student.id,
          start_time: new Date(),
          purpose: 'Study session'
        }
      })

      const activeSessions = await getEquipmentSessions(equipment.id, { activeOnly: true })
      expect(activeSessions).toHaveLength(1)
      expect(activeSessions[0].equipment_id).toBe(equipment.id)
      expect(activeSessions[0].end_time).toBeNull()
    })

    it('should return all sessions for equipment', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      // Create test student
      const student = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id: 'STU001',
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 10',
          grade_category: 'SENIOR_HIGH',
          section: '10-A'
        }
      })

      // Create completed session
      await prisma.equipment_sessions.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: equipment.id,
          student_id: student.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          end_time: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          purpose: 'Study session'
        }
      })

      const allSessions = await getEquipmentSessions(equipment.id)
      expect(allSessions).toHaveLength(1)
      expect(allSessions[0].equipment_id).toBe(equipment.id)
      expect(allSessions[0].end_time).toBeDefined()
    })
  })

  describe('getEquipmentUsageStats', () => {
    it('should return usage statistics for equipment', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      // Create test student
      const student = await prisma.students.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          student_id: 'STU001',
          first_name: 'John',
          last_name: 'Doe',
          grade_level: 'Grade 10',
          grade_category: 'SENIOR_HIGH',
          section: '10-A'
        }
      })

      // Create completed session
      await prisma.equipment_sessions.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          equipment_id: equipment.id,
          student_id: student.id,
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          end_time: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          purpose: 'Study session'
        }
      })

      const stats = await getEquipmentUsageStats(equipment.id)
      expect(stats).toBeDefined()
      expect(stats.totalSessions).toBe(1)
      expect(stats.totalUsageMinutes).toBe(60) // 1 hour = 60 minutes
      expect(stats.averageSessionMinutes).toBe(60)
      expect(stats.mostUsedBy).toBeDefined()
    })

    it('should return zero stats for equipment with no usage', async () => {
      // Create test equipment
      const equipment = await prisma.equipment.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          name: 'Test Computer',
          category: EquipmentCategory.COMPUTER,
          status: equipment_status.AVAILABLE,
          assetTag: 'EQ001'
        }
      })

      const stats = await getEquipmentUsageStats(equipment.id)
      expect(stats).toBeDefined()
      expect(stats.totalSessions).toBe(0)
      expect(stats.totalUsageMinutes).toBe(0)
      expect(stats.averageSessionMinutes).toBe(0)
    })
  })
})