import { faker } from '@faker-js/faker';
import {
  GradeCategory,
  EquipmentType,
  EquipmentStatus,
  ActivityType,
  ActivityStatus,
  users_role,
  CheckoutStatus,
  notifications_type,
  notifications_priority
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MockDataOptions {
  studentsCount?: number;
  booksCount?: number;
  equipmentCount?: number;
  activitiesCount?: number;
  checkoutsCount?: number;
  usersCount?: number;
  includeInactive?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

class MockDataGenerator {
  private static instance: MockDataGenerator;
  private usedStudentIds: Set<string> = new Set();
  private usedAccessionNumbers: Set<string> = new Set();
  private usedEquipmentIds: Set<string> = new Set();

  static getInstance(): MockDataGenerator {
    if (!MockDataGenerator.instance) {
      MockDataGenerator.instance = new MockDataGenerator();
    }
    return MockDataGenerator.instance;
  }

  /**
   * Generate comprehensive mock data for testing
   */
  async generateMockData(options: MockDataOptions = {}): Promise<{
    students: any[];
    books: any[];
    equipment: any[];
    activities: any[];
    checkouts: any[];
    users: any[];
    notifications: any[];
  }> {
    const {
      studentsCount = 50,
      booksCount = 100,
      equipmentCount = 20,
      activitiesCount = 200,
      checkoutsCount = 150,
      usersCount = 10,
      includeInactive = true,
      dateRange = {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        end: new Date()
      }
    } = options;

    console.log('Generating mock data...');

    const [students, books, equipment, users] = await Promise.all([
      this.generateStudents(studentsCount, includeInactive),
      this.generateBooks(booksCount, includeInactive),
      this.generateEquipment(equipmentCount, includeInactive),
      this.generateUsers(usersCount)
    ]);

    const activities = await this.generateActivities(activitiesCount, students, equipment, dateRange);
    const checkouts = await this.generateCheckouts(checkoutsCount, students, books, dateRange);
    const notifications = await this.generateNotifications(50);

    console.log('Mock data generation completed');

    return {
      students,
      books,
      equipment,
      activities,
      checkouts,
      users,
      notifications
    };
  }

  /**
   * Generate mock students
   */
  async generateStudents(count: number, includeInactive: boolean = true): Promise<any[]> {
    const students = [];
    const gradeCategories: GradeCategory[] = ['PRIMARY', 'GRADE_SCHOOL', 'JUNIOR_HIGH', 'SENIOR_HIGH'];

    for (let i = 0; i < count; i++) {
      const gradeCategory = faker.helpers.arrayElement(gradeCategories);
      const gradeLevel = this.generateGradeLevel(gradeCategory);
      const studentId = this.generateUniqueStudentId();

      const student = {
        id: `student-${faker.string.alphanumeric({ length: 10 })}`,
        studentId,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        gradeLevel,
        gradeCategory,
        section: faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'E']),
        isActive: includeInactive ? faker.datatype.boolean({ probability: 0.9 }) : true,
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      students.push(student);
    }

    return students;
  }

  /**
   * Generate mock books
   */
  async generateBooks(count: number, includeInactive: boolean = true): Promise<any[]> {
    const books = [];
    const categories = [
      'Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'History', 'Biography',
      'Technology', 'Arts', 'Literature', 'Reference', 'Children', 'Young Adult'
    ];

    for (let i = 0; i < count; i++) {
      const totalCopies = faker.number.int({ min: 1, max: 10 });
      const availableCopies = faker.number.int({ min: 0, max: totalCopies });

      const book = {
        id: `book-${faker.string.alphanumeric({ length: 10 })}`,
        accessionNo: this.generateUniqueAccessionNumber(),
        title: faker.lorem.words({ min: 2, max: 8 }),
        author: `${faker.person.firstName()} ${faker.person.lastName()}`,
        isbn: faker.commerce.isbn(),
        publisher: faker.company.name(),
        category: faker.helpers.arrayElement(categories),
        subcategory: faker.helpers.arrayElement(categories),
        location: `${faker.string.alpha({ length: 1 })}${faker.number.int({ min: 1, max: 20 })}-${faker.string.alpha({ length: 1 })}${faker.number.int({ min: 1, max: 30 })}`,
        totalCopies,
        availableCopies,
        isActive: includeInactive ? faker.datatype.boolean({ probability: 0.95 }) : true,
        year: faker.number.int({ min: 1900, max: 2024 }),
        pages: faker.number.int({ min: 50, max: 1000 }).toString(),
        edition: faker.number.int({ min: 1, max: 10 }).toString(),
        costPrice: parseFloat(faker.commerce.price({ min: 10, max: 100 })),
        sourceOfFund: faker.helpers.arrayElement(['Library Budget', 'Donation', 'Government Fund']),
        remarks: faker.lorem.sentences({ min: 1, max: 3 }),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      books.push(book);
    }

    return books;
  }

  /**
   * Generate mock equipment
   */
  async generateEquipment(count: number, includeInactive: boolean = true): Promise<any[]> {
    const equipment = [];
    const equipmentTypes: EquipmentType[] = ['COMPUTER', 'GAMING', 'AVR', 'PRINTER', 'SCANNER', 'OTHER'];
    const equipmentStatuses: EquipmentStatus[] = includeInactive
      ? ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_ORDER']
      : ['AVAILABLE', 'IN_USE'];

    for (let i = 0; i < count; i++) {
      const type = faker.helpers.arrayElement(equipmentTypes);
      const status = faker.helpers.arrayElement(equipmentStatuses);

      const equipmentItem = {
        id: `equipment-${faker.string.alphanumeric({ length: 10 })}`,
        equipmentId: this.generateUniqueEquipmentId(type),
        name: this.generateEquipmentName(type),
        type,
        status,
        location: `${faker.helpers.arrayElement(['Lab A', 'Lab B', 'Library', 'Game Room', 'Media Room'])} - ${faker.number.int({ min: 1, max: 20 })}`,
        maxTimeMinutes: faker.number.int({ min: 30, max: 180 }),
        requiresSupervision: type === 'GAMING' || type === 'AVR' ? true : faker.datatype.boolean({ probability: 0.3 }),
        description: faker.lorem.sentences({ min: 1, max: 2 }),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      equipment.push(equipmentItem);
    }

    return equipment;
  }

  /**
   * Generate mock users
   */
  async generateUsers(count: number): Promise<any[]> {
    const users = [];
    const roles: users_role[] = ['SUPER_ADMIN', 'ADMIN', 'LIBRARIAN', 'ASSISTANT', 'TEACHER', 'VIEWER'];

    for (let i = 0; i < count; i++) {
      const role = faker.helpers.arrayElement(roles);

      const user = {
        id: `user-${faker.string.alphanumeric({ length: 10 })}`,
        username: faker.internet.username(),
        password: '$2b$12$hashedPassword', // In real tests, this would be properly hashed
        role,
        isActive: faker.datatype.boolean({ probability: 0.95 }),
        email: faker.internet.email(),
        fullName: `${faker.person.firstName()} ${faker.person.lastName()}`,
        permissions: role === 'SUPER_ADMIN' ? null : faker.helpers.arrayElements([
          'STUDENTS_VIEW', 'STUDENTS_CREATE', 'STUDENTS_UPDATE',
          'BOOKS_VIEW', 'BOOKS_CREATE', 'BOOKS_UPDATE',
          'EQUIPMENT_VIEW', 'EQUIPMENT_ASSIGN',
          'ANALYTICS_VIEW'
        ], { min: 1, max: 3 }),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        lastLoginAt: faker.date.recent()
      };

      users.push(user);
    }

    return users;
  }

  /**
   * Generate mock student activities
   */
  async generateActivities(count: number, students: any[], equipment: any[], dateRange: { start: Date, end: Date }): Promise<any[]> {
    const activities = [];
    const activityTypes: ActivityType[] = [
      'COMPUTER_USE', 'GAMING_SESSION', 'AVR_SESSION', 'BOOK_CHECKOUT',
      'BOOK_RETURN', 'GENERAL_VISIT', 'RECREATION', 'STUDY', 'OTHER'
    ];
    const statuses: ActivityStatus[] = ['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'EXTENDED'];

    for (let i = 0; i < count; i++) {
      const student = faker.helpers.arrayElement(students);
      const activityType = faker.helpers.arrayElement(activityTypes);
      const status = faker.helpers.arrayElement(statuses);
      const startTime = faker.date.between({ from: dateRange.start, to: dateRange.end });

      let endTime: Date | null = null;
      let durationMinutes: number | null = null;

      if (status !== 'ACTIVE') {
        endTime = faker.date.between({ from: startTime, to: new Date(Math.min(startTime.getTime() + 4 * 60 * 60 * 1000, dateRange.end.getTime())) });
        durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      }

      const activity = {
        id: `activity-${faker.string.alphanumeric({ length: 10 })}`,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        gradeLevel: student.gradeLevel,
        gradeCategory: student.gradeCategory,
        activityType,
        equipmentId: activityType.includes('COMPUTER') || activityType.includes('GAMING') || activityType.includes('AVR')
          ? faker.helpers.arrayElement(equipment).id
          : null,
        checkoutId: activityType.includes('BOOK') ? `checkout-${faker.string.alphanumeric({ length: 8 })}` : null,
        startTime,
        endTime,
        durationMinutes,
        timeLimitMinutes: this.getTimeLimitByGrade(student.gradeCategory),
        status,
        notes: faker.lorem.sentences({ min: 0, max: 2 }) || null,
        processedBy: faker.helpers.arrayElement(['Sophia', 'Librarian', 'System']),
        googleSynced: faker.datatype.boolean({ probability: 0.8 }),
        syncAttempts: faker.number.int({ min: 0, max: 5 }),
        createdAt: startTime,
        updatedAt: endTime || new Date()
      };

      activities.push(activity);
    }

    return activities;
  }

  /**
   * Generate mock book checkouts
   */
  async generateCheckouts(count: number, students: any[], books: any[], dateRange: { start: Date, end: Date }): Promise<any[]> {
    const checkouts = [];
    const statuses: CheckoutStatus[] = ['ACTIVE', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED'];

    for (let i = 0; i < count; i++) {
      const student = faker.helpers.arrayElement(students);
      const book = faker.helpers.arrayElement(books);
      const status = faker.helpers.arrayElement(statuses);
      const checkoutDate = faker.date.between({ from: dateRange.start, to: dateRange.end });

      let returnDate: Date | null = null;
      let dueDate = new Date(checkoutDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks

      if (status === 'RETURNED') {
        returnDate = faker.date.between({ from: checkoutDate, to: new Date(Math.min(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000, dateRange.end.getTime())) });
      } else if (status === 'OVERDUE') {
        returnDate = null;
        dueDate = new Date(checkoutDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Set due date in past
      }

      const overdueDays = returnDate && dueDate < returnDate
        ? Math.floor((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const fineAmount = overdueDays > 0 ? overdueDays * 0.50 : 0;

      const checkout = {
        id: `checkout-${faker.string.alphanumeric({ length: 10 })}`,
        bookId: book.id,
        studentId: student.id,
        status,
        notes: faker.lorem.sentences({ min: 0, max: 2 }) || null,
        checkoutDate,
        dueDate,
        returnDate,
        processedBy: faker.helpers.arrayElement(['Sophia', 'Librarian', 'System']),
        fineAmount,
        finePaid: fineAmount > 0 ? faker.datatype.boolean({ probability: 0.6 }) : true,
        overdueDays,
        created_at: checkoutDate,
        updated_at: returnDate || new Date()
      };

      checkouts.push(checkout);
    }

    return checkouts;
  }

  /**
   * Generate mock notifications
   */
  async generateNotifications(count: number): Promise<any[]> {
    const notifications = [];
    const types: notifications_type[] = [
      'OVERDUE_BOOK', 'FINE_ADDED', 'BOOK_DUE_SOON', 'EQUIPMENT_EXPIRING',
      'SYSTEM_ALERT', 'INFO', 'WARNING', 'ERROR', 'SUCCESS'
    ];
    const priorities: notifications_priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    for (let i = 0; i < count; i++) {
      const notification = {
        id: `notification-${faker.string.alphanumeric({ length: 10 })}`,
        userId: faker.helpers.arrayElement([`user-super-admin`, `user-admin`, `user-librarian`]) || null,
        type: faker.helpers.arrayElement(types),
        title: faker.lorem.words({ min: 2, max: 6 }),
        message: faker.lorem.sentences({ min: 1, max: 3 }),
        priority: faker.helpers.arrayElement(priorities),
        read: faker.datatype.boolean({ probability: 0.6 }),
        readAt: faker.datatype.boolean({ probability: 0.3 }) ? faker.date.recent() : null,
        actionUrl: faker.datatype.boolean({ probability: 0.4 }) ? faker.internet.url() : null,
        metadata: faker.datatype.boolean({ probability: 0.3 }) ? {
          relatedId: faker.string.alphanumeric({ length: 8 }),
          relatedType: faker.helpers.arrayElement(['student', 'book', 'equipment'])
        } : null,
        created_at: faker.date.recent(),
        expires_at: faker.datatype.boolean({ probability: 0.7 }) ? faker.date.future() : null
      };

      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Generate unique student ID
   */
  private generateUniqueStudentId(): string {
    let studentId: string;
    do {
      const year = faker.number.int({ min: 2020, max: 2024 });
      const number = faker.number.int({ min: 1, max: 9999 }).toString().padStart(4, '0');
      studentId = `${year}-${number}`;
    } while (this.usedStudentIds.has(studentId));

    this.usedStudentIds.add(studentId);
    return studentId;
  }

  /**
   * Generate unique accession number
   */
  private generateUniqueAccessionNumber(): string {
    let accessionNo: string;
    do {
      accessionNo = `ACC-${faker.number.int({ min: 1000, max: 9999 })}`;
    } while (this.usedAccessionNumbers.has(accessionNo));

    this.usedAccessionNumbers.add(accessionNo);
    return accessionNo;
  }

  /**
   * Generate unique equipment ID
   */
  private generateUniqueEquipmentId(type: EquipmentType): string {
    let equipmentId: string;
    do {
      const prefix = type.substring(0, 4).toUpperCase();
      const number = faker.number.int({ min: 1, max: 999 }).toString().padStart(3, '0');
      equipmentId = `${prefix}-${number}`;
    } while (this.usedEquipmentIds.has(equipmentId));

    this.usedEquipmentIds.add(equipmentId);
    return equipmentId;
  }

  /**
   * Generate grade level based on category
   */
  private generateGradeLevel(category: GradeCategory): string {
    switch (category) {
      case 'PRIMARY':
        return faker.helpers.arrayElement(['Grade 1', 'Grade 2', 'Grade 3']);
      case 'GRADE_SCHOOL':
        return faker.helpers.arrayElement(['Grade 4', 'Grade 5', 'Grade 6']);
      case 'JUNIOR_HIGH':
        return faker.helpers.arrayElement(['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
      case 'SENIOR_HIGH':
        return faker.helpers.arrayElement(['Grade 11', 'Grade 12']);
      default:
        return 'Grade 10';
    }
  }

  /**
   * Generate equipment name based on type
   */
  private generateEquipmentName(type: EquipmentType): string {
    switch (type) {
      case 'COMPUTER':
        return `Computer Station ${faker.number.int({ min: 1, max: 50 })}`;
      case 'GAMING':
        return `Gaming Console ${faker.number.int({ min: 1, max: 10 })}`;
      case 'AVR':
        return `AVR Equipment Set ${faker.number.int({ min: 1, max: 5 })}`;
      case 'PRINTER':
        return `Printer ${faker.number.int({ min: 1, max: 10 })}`;
      case 'SCANNER':
        return `Scanner ${faker.number.int({ min: 1, max: 5 })}`;
      case 'OTHER':
        return faker.helpers.arrayElement(['Tablet', 'Projector', 'Whiteboard', 'Camera']) + ` ${faker.number.int({ min: 1, max: 10 })}`;
      default:
        return `Equipment ${faker.number.int({ min: 1, max: 100 })}`;
    }
  }

  /**
   * Get time limit by grade category
   */
  private getTimeLimitByGrade(category: GradeCategory): number {
    switch (category) {
      case 'PRIMARY':
        return 30;
      case 'GRADE_SCHOOL':
        return 45;
      case 'JUNIOR_HIGH':
        return 60;
      case 'SENIOR_HIGH':
        return 90;
      default:
        return 60;
    }
  }

  /**
   * Clear used IDs cache
   */
  clearCache(): void {
    this.usedStudentIds.clear();
    this.usedAccessionNumbers.clear();
    this.usedEquipmentIds.clear();
  }
}

export default MockDataGenerator;