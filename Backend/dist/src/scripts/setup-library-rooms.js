#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupLibraryRooms = setupLibraryRooms;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const prisma = new client_1.PrismaClient();
async function setupLibraryRooms() {
    console.log('🏛️  Setting up CLMS Library Rooms Configuration...\n');
    try {
        console.log('1. Setting up admin user...');
        const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
        await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password: hashedPassword,
                role: 'ADMIN',
                isActive: true,
                email: 'library@shjs.edu.ph'
            }
        });
        console.log('✅ Admin user created/updated\n');
        console.log('2. Setting up librarian user...');
        await prisma.user.upsert({
            where: { username: 'librarian' },
            update: {},
            create: {
                username: 'librarian',
                password: hashedPassword,
                role: 'LIBRARIAN',
                isActive: true,
                email: 'librarian@shjs.edu.ph'
            }
        });
        console.log('✅ Librarian user created\n');
        console.log('3. Setting up system configuration...');
        const systemConfigs = [
            {
                key: 'library_name',
                value: 'Sacred Heart of Jesus Catholic School Library',
                description: 'Library name for display purposes',
                isSecret: false,
                category: 'General'
            },
            {
                key: 'library_hours',
                value: '7:30 AM - 5:00 PM',
                description: 'Library operating hours',
                isSecret: false,
                category: 'General'
            },
            {
                key: 'max_pc_session_duration',
                value: '60',
                description: 'Maximum PC session duration in minutes',
                isSecret: false,
                category: 'Limits'
            },
            {
                key: 'max_room_session_duration',
                value: '120',
                description: 'Maximum room session duration in minutes',
                isSecret: false,
                category: 'Limits'
            },
            {
                key: 'max_daily_sessions',
                value: '3',
                description: 'Maximum sessions per student per day',
                isSecret: false,
                category: 'Limits'
            },
            {
                key: 'total_pcs',
                value: '3',
                description: 'Total number of PCs available',
                isSecret: false,
                category: 'Inventory'
            },
            {
                key: 'total_rooms',
                value: '2',
                description: 'Total number of rooms available (AVR + Recreational)',
                isSecret: false,
                category: 'Inventory'
            },
            {
                key: 'google_sheets_enabled',
                value: 'false',
                description: 'Enable Google Sheets integration',
                isSecret: false,
                category: 'Integration'
            },
            {
                key: 'automated_backup',
                value: 'true',
                description: 'Enable automated backups',
                isSecret: false,
                category: 'Backup'
            },
            {
                key: 'notification_email',
                value: 'library@shjs.edu.ph',
                description: 'Library notification email',
                isSecret: false,
                category: 'Notifications'
            }
        ];
        for (const config of systemConfigs) {
            await prisma.systemConfig.upsert({
                where: { key: config.key },
                update: config,
                create: config
            });
        }
        console.log('✅ System configuration created\n');
        console.log('4. Setting up PCs for individual tracking...');
        const pcs = [
            {
                name: 'PC Station 1',
                type: 'Computer',
                status: 'available',
                location: 'Computer Area',
                specifications: 'Windows 11, Core i3, 8GB RAM, Web browser, Office apps',
                purchaseDate: new Date('2023-01-15'),
                lastMaintenanceDate: new Date(),
                warrantyExpiry: new Date('2025-01-15'),
                notes: 'General purpose computer for student use',
                isActive: true
            },
            {
                name: 'PC Station 2',
                type: 'Computer',
                status: 'available',
                location: 'Computer Area',
                specifications: 'Windows 11, Core i3, 8GB RAM, Web browser, Office apps',
                purchaseDate: new Date('2023-01-15'),
                lastMaintenanceDate: new Date(),
                warrantyExpiry: new Date('2025-01-15'),
                notes: 'General purpose computer for student use',
                isActive: true
            },
            {
                name: 'PC Station 3',
                type: 'Computer',
                status: 'available',
                location: 'Computer Area',
                specifications: 'Windows 11, Core i3, 8GB RAM, Web browser, Office apps',
                purchaseDate: new Date('2023-01-15'),
                lastMaintenanceDate: new Date(),
                warrantyExpiry: new Date('2025-01-15'),
                notes: 'General purpose computer for student use',
                isActive: true
            }
        ];
        for (const pc of pcs) {
            await prisma.equipment.upsert({
                where: { name: pc.name },
                update: pc,
                create: pc
            });
        }
        console.log('✅ 3 PC stations created\n');
        console.log('5. Setting up rooms...');
        const rooms = [
            {
                name: 'AVR Room',
                type: 'Study Room',
                status: 'available',
                location: 'Room 201',
                specifications: 'Audio-Visual Room, Projector, Whiteboard, Seats 30 students',
                purchaseDate: new Date('2022-06-01'),
                lastMaintenanceDate: new Date(),
                warrantyExpiry: new Date('2027-06-01'),
                notes: 'Audio-Visual room for group study and presentations',
                isActive: true
            },
            {
                name: 'Recreational Room',
                type: 'Recreational Room',
                status: 'available',
                location: 'Room 202',
                specifications: 'Chess set, PlayStation 4, TV, Board games, Comfortable seating',
                purchaseDate: new Date('2022-06-01'),
                lastMaintenanceDate: new Date(),
                warrantyExpiry: new Date('2027-06-01'),
                notes: 'Recreational room for chess, gaming, and relaxation',
                isActive: true
            }
        ];
        for (const room of rooms) {
            await prisma.equipment.upsert({
                where: { name: room.name },
                update: room,
                create: room
            });
        }
        console.log('✅ 2 rooms created (AVR + Recreational)\n');
        console.log('6. Setting up automation jobs...');
        const automationJobs = [
            {
                name: 'Daily Backup',
                type: 'BACKUP',
                schedule: '0 18 * * *',
                description: 'Automated daily database backup at closing time',
                isEnabled: true,
                status: 'IDLE'
            },
            {
                name: 'Weekly Report',
                type: 'REPORT',
                schedule: '0 8 * * 1',
                description: 'Generate weekly library usage report',
                isEnabled: true,
                status: 'IDLE'
            },
            {
                name: 'Session Cleanup',
                type: 'CLEANUP',
                schedule: '0 19 * * *',
                description: 'Clean up expired sessions and update statistics',
                isEnabled: true,
                status: 'IDLE'
            },
            {
                name: 'Room Maintenance Check',
                type: 'MAINTENANCE',
                schedule: '0 7 * * 1',
                description: 'Weekly room and equipment maintenance reminder',
                isEnabled: true,
                status: 'IDLE'
            }
        ];
        for (const job of automationJobs) {
            await prisma.automationJob.upsert({
                where: { name: job.name },
                update: job,
                create: {
                    ...job,
                    nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            });
        }
        console.log('✅ 4 automation jobs created\n');
        console.log('7. Creating sample book collection...');
        const sampleBooks = [
            {
                title: 'Philippine History',
                author: 'Teodoro Agoncillo',
                isbn: '978-971-8975-23-1',
                category: 'Educational',
                status: 'available',
                totalCopies: 2,
                availableCopies: 2,
                publisher: 'University of the Philippines Press',
                publishYear: 2020,
                pageCount: 450,
                language: 'English',
                location: 'Shelf A1',
                purchaseDate: new Date('2023-01-01'),
                cost: 350,
                description: 'Comprehensive Philippine history textbook',
                tags: ['History', 'Philippines', 'Education'],
                isActive: true
            },
            {
                title: 'Mathematics for Grade 10',
                author: 'Department of Education',
                isbn: '978-971-9408-45-2',
                category: 'Educational',
                status: 'available',
                totalCopies: 5,
                availableCopies: 5,
                publisher: 'DepEd',
                publishYear: 2022,
                pageCount: 320,
                language: 'English',
                location: 'Shelf B2',
                purchaseDate: new Date('2023-06-01'),
                cost: 280,
                description: 'Official Grade 10 mathematics textbook',
                tags: ['Mathematics', 'Grade 10', 'Education'],
                isActive: true
            },
            {
                title: 'English Grammar and Composition',
                author: 'Leticia Ramos',
                isbn: '978-971-0255-67-3',
                category: 'Educational',
                status: 'available',
                totalCopies: 3,
                availableCopies: 3,
                publisher: 'Phoenix Publishing House',
                publishYear: 2021,
                pageCount: 280,
                language: 'English',
                location: 'Shelf C3',
                purchaseDate: new Date('2023-03-15'),
                cost: 295,
                description: 'English grammar and composition guide',
                tags: ['English', 'Grammar', 'Education'],
                isActive: true
            },
            {
                title: 'Science and Technology Quarterly',
                author: 'DOST',
                isbn: '978-971-8765-12-4',
                category: 'Reference',
                status: 'available',
                totalCopies: 2,
                availableCopies: 2,
                publisher: 'Department of Science and Technology',
                publishYear: 2023,
                pageCount: 120,
                language: 'English',
                location: 'Shelf D1',
                purchaseDate: new Date('2023-09-01'),
                cost: 150,
                description: 'Quarterly science and technology journal',
                tags: ['Science', 'Technology', 'Reference'],
                isActive: true
            },
            {
                title: 'Noli Me Tangere',
                author: 'Jose Rizal',
                isbn: '978-971-0821-34-5',
                category: 'Fiction',
                status: 'available',
                totalCopies: 4,
                availableCopies: 4,
                publisher: 'National Book Store',
                publishYear: 2022,
                pageCount: 380,
                language: 'Filipino',
                location: 'Shelf E2',
                purchaseDate: new Date('2023-02-20'),
                cost: 225,
                description: 'Classic Philippine novel by Jose Rizal',
                tags: ['Fiction', 'Classic', 'Philippine Literature'],
                isActive: true
            }
        ];
        for (const book of sampleBooks) {
            await prisma.book.upsert({
                where: { isbn: book.isbn },
                update: book,
                create: book
            });
        }
        console.log('✅ 5 sample books created\n');
        console.log('🎉 Library setup completed successfully!\n');
        console.log('📊 Setup Summary:');
        console.log('  👤 Users: 2 (admin, librarian)');
        console.log('  💻 PCs: 3 (individual tracking)');
        console.log('  🏛️  Rooms: 2 (AVR Room, Recreational Room)');
        console.log('  📚 Books: 5 (sample collection)');
        console.log('  ⚙️  System Config: 10 settings');
        console.log('  🤖 Automation Jobs: 4 scheduled tasks\n');
        console.log('🔐 Login Credentials:');
        console.log('  Admin: admin / admin123');
        console.log('  Librarian: librarian / admin123\n');
        console.log('📍 Equipment Tracking:');
        console.log('  - PC Station 1, 2, 3: Individual tracking');
        console.log('  - AVR Room: Room-level tracking');
        console.log('  - Recreational Room: Room-level tracking\n');
        console.log('⏰ Session Limits:');
        console.log('  - PCs: 60 minutes per session');
        console.log('  - Rooms: 120 minutes per session');
        console.log('  - Maximum daily sessions: 3 per student\n');
    }
    catch (error) {
        console.error('❌ Error setting up library rooms:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    setupLibraryRooms();
}
//# sourceMappingURL=setup-library-rooms.js.map