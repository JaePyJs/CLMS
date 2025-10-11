/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const prisma = new PrismaClient();
const rl = createInterface({ input, output });

const ROLES = ['ADMIN', 'LIBRARIAN'] as const;
type ManagedRole = (typeof ROLES)[number];

async function listManagedUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: { in: ROLES as unknown as string[] } },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  });

  if (users.length === 0) {
    console.log('\nNo admin or librarian accounts found.');
    return;
  }

  console.log('\nCurrent admin/librarian accounts:');
  users.forEach(user => {
    console.log(`- ${user.username} (${user.role})${user.isActive ? '' : ' [inactive]'}`);
  });
}

async function addManagedUser(): Promise<void> {
  const username = (await rl.question('\nEnter username: ')).trim();
  if (!username) {
    console.log('Username is required.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log('A user with that username already exists.');
    return;
  }

  const roleInput = (await rl.question('Enter role (admin/librarian): ')).trim().toUpperCase();
  const role = ROLES.find(r => r === roleInput) ?? null;
  if (!role) {
    console.log('Invalid role. Please enter either admin or librarian.');
    return;
  }

  const password = (await rl.question('Enter password: ')).trim();
  if (!password) {
    console.log('Password is required.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role,
      isActive: true,
    },
  });

  console.log(`Created ${role.toLowerCase()} account for ${username}.`);
}

async function removeManagedUser(): Promise<void> {
  const username = (await rl.question('\nEnter username to remove: ')).trim();
  if (!username) {
    console.log('Username is required.');
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !ROLES.includes(user.role as ManagedRole)) {
    console.log('No admin or librarian found with that username.');
    return;
  }

  const confirmation = (await rl.question(`Type "DELETE" to remove ${username}: `)).trim();
  if (confirmation !== 'DELETE') {
    console.log('Deletion cancelled.');
    return;
  }

  await prisma.user.delete({ where: { username } });
  console.log(`Removed account ${username}.`);
}

async function showMenu(): Promise<void> {
  let exit = false;
  while (!exit) {
    console.log('\n==== Admin & Librarian Manager ====');
    console.log('1) List accounts');
    console.log('2) Add account');
    console.log('3) Remove account');
    console.log('4) Exit');
    const choice = (await rl.question('Select an option: ')).trim();

    switch (choice) {
      case '1':
        await listManagedUsers();
        break;
      case '2':
        await addManagedUser();
        break;
      case '3':
        await removeManagedUser();
        break;
      case '4':
        exit = true;
        break;
      default:
        console.log('Invalid choice. Please select 1-4.');
    }
  }
}

async function main(): Promise<void> {
  try {
    await showMenu();
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

if (require.main === module) {
  void main();
}

export { main };
