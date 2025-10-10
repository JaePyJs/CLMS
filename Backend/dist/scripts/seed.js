"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seeding...');
    console.log('Clearing existing data...');
    await prisma.activity.deleteMany();
    await prisma.equipmentSession.deleteMany();
    await prisma.bookCheckout.deleteMany();
    await prisma.student.deleteMany();
    await prisma.book.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.user.deleteMany();
    console.log('Creating admin user...');
    const hashedPassword = await bcryptjs_1.default.hash(process.env.ADMIN_PASSWORD || 'librarian123', 12);
    await prisma.user.create({
        data: {
            username: process.env.ADMIN_USERNAME || 'admin',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log('Creating sample students...');
    const students = [
        {
            studentId: '2024-0001',
            firstName: 'Juan',
            lastName: 'Dela Cruz',
            gradeLevel: 'Grade 1',
            gradeCategory: client_1.GradeCategory.PRIMARY,
        },
        {
            studentId: '2024-0002',
            firstName: 'Maria',
            lastName: 'Santos',
            gradeLevel: 'Grade 2',
            gradeCategory: client_1.GradeCategory.PRIMARY,
        },
        {
            studentId: '2024-0003',
            firstName: 'Pedro',
            lastName: 'Reyes',
            gradeLevel: 'Grade 3',
            gradeCategory: client_1.GradeCategory.PRIMARY,
        },
        {
            studentId: '2024-0004',
            firstName: 'Ana',
            lastName: 'Garcia',
            gradeLevel: 'Grade 4',
            gradeCategory: client_1.GradeCategory.GRADE_SCHOOL,
        },
        {
            studentId: '2024-0005',
            firstName: 'Carlos',
            lastName: 'Torres',
            gradeLevel: 'Grade 5',
            gradeCategory: client_1.GradeCategory.GRADE_SCHOOL,
        },
        {
            studentId: '2024-0006',
            firstName: 'Sofia',
            lastName: 'Martinez',
            gradeLevel: 'Grade 6',
            gradeCategory: client_1.GradeCategory.GRADE_SCHOOL,
        },
        {
            studentId: '2024-0007',
            firstName: 'Miguel',
            lastName: 'Ramos',
            gradeLevel: 'Grade 7',
            gradeCategory: client_1.GradeCategory.JUNIOR_HIGH,
        },
        {
            studentId: '2024-0008',
            firstName: 'Isabel',
            lastName: 'Cruz',
            gradeLevel: 'Grade 8',
            gradeCategory: client_1.GradeCategory.JUNIOR_HIGH,
        },
        {
            studentId: '2024-0009',
            firstName: 'Diego',
            lastName: 'Flores',
            gradeLevel: 'Grade 9',
            gradeCategory: client_1.GradeCategory.JUNIOR_HIGH,
        },
        {
            studentId: '2024-0010',
            firstName: 'Lucia',
            lastName: 'Mendoza',
            gradeLevel: 'Grade 10',
            gradeCategory: client_1.GradeCategory.JUNIOR_HIGH,
        },
        {
            studentId: '2024-0011',
            firstName: 'Rafael',
            lastName: 'Navarro',
            gradeLevel: 'Grade 11',
            gradeCategory: client_1.GradeCategory.SENIOR_HIGH,
        },
        {
            studentId: '2024-0012',
            firstName: 'Carmen',
            lastName: 'Morales',
            gradeLevel: 'Grade 12',
            gradeCategory: client_1.GradeCategory.SENIOR_HIGH,
        },
    ];
    for (const student of students) {
        await prisma.student.create({ data: student });
    }
    console.log('Creating sample books...');
    const books = [
        {
            accessionNo: 'BK-2024-001',
            title: 'Introduction to Science',
            author: 'Dr. John Smith',
            publisher: 'Educational Press',
            category: 'Science',
            totalCopies: 5,
            availableCopies: 5,
        },
        {
            accessionNo: 'BK-2024-002',
            title: 'World History',
            author: 'Prof. Jane Doe',
            publisher: 'History Books Inc',
            category: 'History',
            totalCopies: 3,
            availableCopies: 3,
        },
        {
            accessionNo: 'BK-2024-003',
            title: 'English Grammar',
            author: 'Mary Johnson',
            publisher: 'Language Arts Co',
            category: 'English',
            totalCopies: 10,
            availableCopies: 10,
        },
        {
            accessionNo: 'BK-2024-004',
            title: 'Mathematics Fundamentals',
            author: 'Robert Brown',
            publisher: 'Math Publishers',
            category: 'Mathematics',
            totalCopies: 8,
            availableCopies: 8,
        },
        {
            accessionNo: 'BK-2024-005',
            title: 'Filipino Literature',
            author: 'Jose Rizal',
            publisher: 'National Book Store',
            category: 'Filipino',
            totalCopies: 6,
            availableCopies: 6,
        },
    ];
    for (const book of books) {
        await prisma.book.create({ data: book });
    }
    console.log('Creating sample equipment...');
    const equipment = [
        {
            equipmentId: 'COMP-01',
            name: 'Computer Station 1',
            type: client_1.EquipmentType.COMPUTER,
            location: 'Main Floor',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 60,
        },
        {
            equipmentId: 'COMP-02',
            name: 'Computer Station 2',
            type: client_1.EquipmentType.COMPUTER,
            location: 'Main Floor',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 60,
        },
        {
            equipmentId: 'COMP-03',
            name: 'Computer Station 3',
            type: client_1.EquipmentType.COMPUTER,
            location: 'Main Floor',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 60,
        },
        {
            equipmentId: 'COMP-04',
            name: 'Computer Station 4',
            type: client_1.EquipmentType.COMPUTER,
            location: 'Main Floor',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 60,
        },
        {
            equipmentId: 'GAME-01',
            name: 'Gaming Station 1',
            type: client_1.EquipmentType.GAMING,
            location: 'Recreation Area',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 45,
        },
        {
            equipmentId: 'GAME-02',
            name: 'Gaming Station 2',
            type: client_1.EquipmentType.GAMING,
            location: 'Recreation Area',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 45,
        },
        {
            equipmentId: 'AVR-01',
            name: 'Audio-Visual Room',
            type: client_1.EquipmentType.AVR,
            location: '2nd Floor',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 120,
            requiresSupervision: true,
        },
        {
            equipmentId: 'PRINT-01',
            name: 'Printer Station',
            type: client_1.EquipmentType.PRINTER,
            location: 'Staff Area',
            status: client_1.EquipmentStatus.AVAILABLE,
            maxTimeMinutes: 30,
        },
    ];
    for (const item of equipment) {
        await prisma.equipment.create({ data: item });
    }
    console.log('✅ Seeding completed successfully!');
    console.log(`Created:
  - 1 admin user
  - ${students.length} students
  - ${books.length} books
  - ${equipment.length} equipment items`);
}
main()
    .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map