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
    await prisma.student_activities.deleteMany();
    await prisma.equipment_sessions.deleteMany();
    await prisma.book_checkouts.deleteMany();
    await prisma.students.deleteMany();
    await prisma.books.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.users.deleteMany();
    console.log('Creating admin user...');
    const hashedPassword = await bcryptjs_1.default.hash(process.env.ADMIN_PASSWORD || 'librarian123', 12);
    await prisma.users.create({
        data: { id: crypto.randomUUID(), updated_at: new Date(),
            username: process.env.ADMIN_USERNAME || 'admin',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log('Creating sample students...');
    const students = [
        {
            student_id: '2024-0001',
            first_name: 'Juan',
            last_name: 'Dela Cruz',
            grade_level: 'Grade 1',
            grade_category: client_1.students_grade_category.PRIMARY,
        },
        {
            student_id: '2024-0002',
            first_name: 'Maria',
            last_name: 'Santos',
            grade_level: 'Grade 2',
            grade_category: client_1.students_grade_category.PRIMARY,
        },
        {
            student_id: '2024-0003',
            first_name: 'Pedro',
            last_name: 'Reyes',
            grade_level: 'Grade 3',
            grade_category: client_1.students_grade_category.PRIMARY,
        },
        {
            student_id: '2024-0004',
            first_name: 'Ana',
            last_name: 'Garcia',
            grade_level: 'Grade 4',
            grade_category: client_1.students_grade_category.GRADE_SCHOOL,
        },
        {
            student_id: '2024-0005',
            first_name: 'Carlos',
            last_name: 'Torres',
            grade_level: 'Grade 5',
            grade_category: client_1.students_grade_category.GRADE_SCHOOL,
        },
        {
            student_id: '2024-0006',
            first_name: 'Sofia',
            last_name: 'Martinez',
            grade_level: 'Grade 6',
            grade_category: client_1.students_grade_category.GRADE_SCHOOL,
        },
        {
            student_id: '2024-0007',
            first_name: 'Miguel',
            last_name: 'Ramos',
            grade_level: 'Grade 7',
            grade_category: client_1.students_grade_category.JUNIOR_HIGH,
        },
        {
            student_id: '2024-0008',
            first_name: 'Isabel',
            last_name: 'Cruz',
            grade_level: 'Grade 8',
            grade_category: client_1.students_grade_category.JUNIOR_HIGH,
        },
        {
            student_id: '2024-0009',
            first_name: 'Diego',
            last_name: 'Flores',
            grade_level: 'Grade 9',
            grade_category: client_1.students_grade_category.JUNIOR_HIGH,
        },
        {
            student_id: '2024-0010',
            first_name: 'Lucia',
            last_name: 'Mendoza',
            grade_level: 'Grade 10',
            grade_category: client_1.students_grade_category.JUNIOR_HIGH,
        },
        {
            student_id: '2024-0011',
            first_name: 'Rafael',
            last_name: 'Navarro',
            grade_level: 'Grade 11',
            grade_category: client_1.students_grade_category.SENIOR_HIGH,
        },
        {
            student_id: '2024-0012',
            first_name: 'Carmen',
            last_name: 'Morales',
            grade_level: 'Grade 12',
            grade_category: client_1.students_grade_category.SENIOR_HIGH,
        },
    ];
    for (const student of students) {
        await prisma.students.create({ data: student });
    }
    console.log('Creating sample books...');
    const books = [
        {
            accession_no: 'BK-2024-001',
            title: 'Introduction to Science',
            author: 'Dr. John Smith',
            publisher: 'Educational Press',
            category: 'Science',
            total_copies: 5,
            available_copies: 5,
        },
        {
            accession_no: 'BK-2024-002',
            title: 'World History',
            author: 'Prof. Jane Doe',
            publisher: 'History Books Inc',
            category: 'History',
            total_copies: 3,
            available_copies: 3,
        },
        {
            accession_no: 'BK-2024-003',
            title: 'English Grammar',
            author: 'Mary Johnson',
            publisher: 'Language Arts Co',
            category: 'English',
            total_copies: 10,
            available_copies: 10,
        },
        {
            accession_no: 'BK-2024-004',
            title: 'Mathematics Fundamentals',
            author: 'Robert Brown',
            publisher: 'Math Publishers',
            category: 'Mathematics',
            total_copies: 8,
            available_copies: 8,
        },
        {
            accession_no: 'BK-2024-005',
            title: 'Filipino Literature',
            author: 'Jose Rizal',
            publisher: 'National Book Store',
            category: 'Filipino',
            total_copies: 6,
            available_copies: 6,
        },
    ];
    for (const book of books) {
        await prisma.books.create({ data: book });
    }
    console.log('Creating sample equipment...');
    const equipment = [
        {
            equipment_id: 'COMP-01',
            name: 'Computer Station 1',
            type: client_1.equipment_type.COMPUTER,
            location: 'Main Floor',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 60,
        },
        {
            equipment_id: 'COMP-02',
            name: 'Computer Station 2',
            type: client_1.equipment_type.COMPUTER,
            location: 'Main Floor',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 60,
        },
        {
            equipment_id: 'COMP-03',
            name: 'Computer Station 3',
            type: client_1.equipment_type.COMPUTER,
            location: 'Main Floor',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 60,
        },
        {
            equipment_id: 'COMP-04',
            name: 'Computer Station 4',
            type: client_1.equipment_type.COMPUTER,
            location: 'Main Floor',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 60,
        },
        {
            equipment_id: 'GAME-01',
            name: 'Gaming Station 1',
            type: client_1.equipment_type.GAMING,
            location: 'Recreation Area',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 45,
        },
        {
            equipment_id: 'GAME-02',
            name: 'Gaming Station 2',
            type: client_1.equipment_type.GAMING,
            location: 'Recreation Area',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 45,
        },
        {
            equipment_id: 'AVR-01',
            name: 'Audio-Visual Room',
            type: client_1.equipment_type.AVR,
            location: '2nd Floor',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 120,
            requires_supervision: true,
        },
        {
            equipment_id: 'PRINT-01',
            name: 'Printer Station',
            type: client_1.equipment_type.PRINTER,
            location: 'Staff Area',
            status: client_1.equipment_status.AVAILABLE,
            max_time_minutes: 30,
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
