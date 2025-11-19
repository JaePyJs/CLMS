import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const rounds = Number(process.env.BCRYPT_ROUNDS || 12)

async function updateLibrarianPassword() {
  try {
    // Find librarian user
    const librarian = await prisma.users.findUnique({ 
      where: { username: 'librarian' } 
    })
    
    if (!librarian) {
      console.log('Librarian user not found')
      return
    }

    // Update password with hash
    const hash = await bcrypt.hash('librarian123', rounds)
    const updated = await prisma.users.update({
      where: { id: librarian.id },
      data: {
        password: hash,
      },
    })
    
    console.log('Updated librarian password:', {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      role: updated.role,
    })
    
  } catch (error) {
    console.error('Error updating librarian password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateLibrarianPassword()