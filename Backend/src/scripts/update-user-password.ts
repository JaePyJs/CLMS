import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const [username, newPassword] = process.argv.slice(2)
  if (!username || !newPassword) {
    console.error('Usage: tsx src/scripts/update-user-password.ts <username> <newPassword>')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  try {
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.users.update({ where: { username }, data: { password: hash } })
    console.log(`Password updated for user: ${username}`)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()