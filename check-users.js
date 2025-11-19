import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, email: true, role: true, username: true },
    });
    console.log("Existing users:", JSON.stringify(users, null, 2));

    if (users.length === 0) {
      console.log("No users found, creating librarian user...");
      const librarian = await prisma.users.create({
        data: {
          username: "librarian",
          email: "librarian@clms.com",
          password: "librarian123",
          full_name: "Librarian",
          role: "LIBRARIAN",
        },
      });
      console.log("Created librarian:", librarian);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();