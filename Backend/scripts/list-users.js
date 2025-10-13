const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
    const users = await prisma.users.findMany();
    console.log('\nExisting users:');
    users.forEach(u => console.log(`- Username: ${u.username}, Role: ${u.role}, Active: ${u.is_active}`));
    await prisma.$disconnect();
}

listUsers();
