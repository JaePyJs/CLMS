import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const rounds = Number(process.env.BCRYPT_ROUNDS || 12)

async function createLibrarian() {
  try {
    // Check if librarian user exists
    const existing = await prisma.users.findUnique({ 
      where: { username: 'librarian' } 
    })
    
    if (existing) {
      console.log('Librarian user already exists')
      return
    }

    // Create librarian user with hashed password
    const hash = await bcrypt.hash('librarian123', rounds)
    const librarian = await prisma.users.create({
      data: {
        username: 'librarian',
        email: 'librarian@clms.test',
        password: hash,
        role: 'LIBRARIAN',
        is_active: true,
        full_name: 'Librarian User',
      },
    })
    
    console.log('Created librarian user:', {
      id: librarian.id,
      username: librarian.username,
      email: librarian.email,
      role: librarian.role,
      full_name: librarian.full_name,
    })
    
  } catch (error) {
    console.error('Error creating librarian user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createLibrarian()