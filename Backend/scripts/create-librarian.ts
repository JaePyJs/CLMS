import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createLibrarianAccount() {
  try {
    console.log('Creating default librarian account...')

    // Check if librarian already exists
    const existingLibrarian = await prisma.users.findFirst({
      where: { role: 'LIBRARIAN' }
    })

    if (existingLibrarian) {
      console.log('Librarian account already exists:', existingLibrarian.username)
      return
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12')
    const hashedPassword = await bcrypt.hash('library123', saltRounds)

    // Create default librarian account
    const librarian = await prisma.users.create({
      data: { id: crypto.randomUUID(), updated_at: new Date(), 
        username: 'librarian',
        password: hashedPassword,
        role: 'LIBRARIAN',
        is_active: true
      }
    })

    console.log('✅ Librarian account created successfully!')
    console.log('Username: librarian')
    console.log('Password: library123')
    console.log('⚠️  Please change the default password after first login!')

    // Also create an admin account
    const existingAdmin = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    })

    if (!existingAdmin) {
      const adminHashedPassword = await bcrypt.hash('admin123', parseInt(process.env.BCRYPT_ROUNDS || '12'))
      
      const admin = await prisma.users.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(), 
          username: 'admin',
          password: adminHashedPassword,
          role: 'ADMIN',
          is_active: true
        }
      })

      console.log('✅ Admin account created successfully!')
      console.log('Username: admin')
      console.log('Password: admin123')
      console.log('⚠️  Please change the default password after first login!')
    }

  } catch (error) {
    console.error('Error creating accounts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  createLibrarianAccount()
}

export default createLibrarianAccount