"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function createLibrarianAccount() {
    try {
        console.log('Creating default librarian account...');
        const existingLibrarian = await prisma.users.findFirst({
            where: { role: 'LIBRARIAN' }
        });
        if (existingLibrarian) {
            console.log('Librarian account already exists:', existingLibrarian.username);
            return;
        }
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const hashedPassword = await bcryptjs_1.default.hash('library123', saltRounds);
        const librarian = await prisma.users.create({
            data: { id: crypto.randomUUID(), updated_at: new Date(),
                username: 'librarian',
                password: hashedPassword,
                role: 'LIBRARIAN',
                is_active: true
            }
        });
        console.log('✅ Librarian account created successfully!');
        console.log('Username: librarian');
        console.log('Password: library123');
        console.log('⚠️  Please change the default password after first login!');
        const existingAdmin = await prisma.users.findFirst({
            where: { role: 'ADMIN' }
        });
        if (!existingAdmin) {
            const adminHashedPassword = await bcryptjs_1.default.hash('admin123', parseInt(process.env.BCRYPT_ROUNDS || '12'));
            const admin = await prisma.users.create({
                data: { id: crypto.randomUUID(), updated_at: new Date(),
                    username: 'admin',
                    password: adminHashedPassword,
                    role: 'ADMIN',
                    is_active: true
                }
            });
            console.log('✅ Admin account created successfully!');
            console.log('Username: admin');
            console.log('Password: admin123');
            console.log('⚠️  Please change the default password after first login!');
        }
    }
    catch (error) {
        console.error('Error creating accounts:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
if (require.main === module) {
    createLibrarianAccount();
}
exports.default = createLibrarianAccount;
//# sourceMappingURL=create-librarian.js.map