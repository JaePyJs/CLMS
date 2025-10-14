import { faker } from '@faker-js/faker';
import type {
  Student,
  Book,
  Equipment,
  User,
  StudentActivity,
  BookCheckout,
  BarcodeHistory,
  AuditLog,
  Notification
} from '@prisma/client';

// Grade categories and time limits
export const GRADE_CATEGORIES = {
  PRIMARY: 'PRIMARY',
  GRADE_7: 'GRADE_7',
  GRADE_8: 'GRADE_8',
  GRADE_9: 'GRADE_9',
  GRADE_10: 'GRADE_10',
  GRADE_11: 'GRADE_11',
  GRADE_12: 'GRADE_12',
  SENIOR_HIGH: 'SENIOR_HIGH'
} as const;

export const TIME_LIMITS = {
  PRIMARY: 45,
  GRADE_7: 60,
  GRADE_8: 60,
  GRADE_9: 90,
  GRADE_10: 90,
  GRADE_11: 120,
  GRADE_12: 120,
  SENIOR_HIGH: 120
} as const;

export const ACTIVITY_TYPES = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  BOOK_CHECKOUT: 'BOOK_CHECKOUT',
  BOOK_RETURN: 'BOOK_RETURN',
  EQUIPMENT_USE: 'EQUIPMENT_USE'
} as const;

export const ACTIVITY_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  LIBRARIAN: 'LIBRARIAN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  VIEWER: 'VIEWER'
} as const;

export class TestDataFactory {
  private static counter = 0;

  private static getNextId(): string {
    return (++this.counter).toString();
  }

  // Student Factory
  static createStudent(overrides: Partial<Student> = {}): Student {
    const id = this.getNextId();
    const gradeCategory = faker.helpers.arrayElement(Object.values(GRADE_CATEGORIES));
    const studentId = `TEST${faker.number.int({ min: 2023000, max: 2023999 })}`;

    return {
      id,
      student_id: studentId,
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      grade_level: gradeCategory.replace('_', ' '),
      grade_category: gradeCategory,
      section: `${gradeCategory.split('_')[1]}-${faker.string.alpha({ length: 1 }).toUpperCase()}`,
      is_active: faker.datatype.boolean({ probability: 0.9 }), // 90% active
      created_at: faker.date.past({ years: 2 }),
      updated_at: faker.date.recent({ days: 30 }),
      barcode: studentId,
      photo_url: faker.internet.url(),
      notes: faker.lorem.sentence(),
      guardian_name: faker.person.fullName(),
      guardian_contact: faker.phone.number(),
      email: faker.internet.email(),
      address: faker.location.streetAddress(),
      date_of_birth: faker.date.birthdate({ min: 10, max: 18, mode: 'age' }),
      ...overrides
    } as Student;
  }

  static createStudents(count: number, overrides: Partial<Student> = {}): Student[] {
    return Array.from({ length: count }, () => this.createStudent(overrides));
  }

  // Book Factory
  static createBook(overrides: Partial<Book> = {}): Book {
    const id = this.getNextId();
    const accessionNo = `ACC${faker.number.int({ min: 10000, max: 99999 })}`;

    return {
      id,
      accession_no: accessionNo,
      title: faker.lorem.words({ min: 2, max: 5 }).replace(/\b\w/g, l => l.toUpperCase()),
      author: faker.person.fullName(),
      category: faker.helpers.arrayElement([
        'Fiction', 'Non-Fiction', 'Science', 'History', 'Biography',
        'Reference', 'Technology', 'Mathematics', 'English', 'Filipino'
      ]),
      isbn: faker.string.numeric({ length: 13 }),
      publisher: faker.company.name(),
      publication_year: faker.number.int({ min: 1990, max: 2024 }),
      total_copies: faker.number.int({ min: 1, max: 5 }),
      available_copies: faker.number.int({ min: 0, max: 5 }),
      location: `Shelf ${faker.string.alpha({ length: 1 }).toUpperCase()}${faker.number.int({ min: 1, max: 20 })}`,
      price: faker.number.float({ min: 100, max: 2000, fractionDigits: 2 }),
      description: faker.lorem.paragraph(),
      is_active: faker.datatype.boolean({ probability: 0.95 }), // 95% active
      created_at: faker.date.past({ years: 1 }),
      updated_at: faker.date.recent({ days: 30 }),
      barcode: accessionNo,
      cover_image_url: faker.internet.url(),
      language: faker.helpers.arrayElement(['English', 'Filipino', 'Bilingual']),
      subject: faker.helpers.arrayElement(['General', 'Science', 'Math', 'English', 'History']),
      reading_level: faker.helpers.arrayElement(['Elementary', 'Middle School', 'High School']),
      ...overrides
    } as Book;
  }

  static createBooks(count: number, overrides: Partial<Book> = {}): Book[] {
    return Array.from({ length: count }, () => this.createBook(overrides));
  }

  // Equipment Factory
  static createEquipment(overrides: Partial<Equipment> = {}): Equipment {
    const id = this.getNextId();
    const name = faker.helpers.arrayElement([
      'Computer', 'Projector', 'Printer', 'Scanner', 'Camera',
      'Microscope', 'Tablet', 'Smart Board', 'Document Camera', 'Speaker'
    ]);

    return {
      id,
      name: name,
      category: faker.helpers.arrayElement(['Technology', 'Science', 'Audio/Visual', 'Computing']),
      description: faker.lorem.sentence(),
      serial_number: `SN${faker.string.alphanumeric({ length: 10 }).toUpperCase()}`,
      barcode: `EQ${faker.string.numeric({ length: 6 })}`,
      location: faker.helpers.arrayElement(['Library', 'Computer Lab', 'Science Lab', 'AV Room']),
      status: faker.helpers.arrayElement(['Available', 'In Use', 'Maintenance', 'Retired']),
      condition: faker.helpers.arrayElement(['Excellent', 'Good', 'Fair', 'Poor']),
      purchase_date: faker.date.past({ years: 5 }),
      purchase_cost: faker.number.float({ min: 5000, max: 50000, fractionDigits: 2 }),
      warranty_expiry: faker.date.future({ years: 2 }),
      last_maintenance: faker.date.past({ months: 6 }),
      next_maintenance: faker.date.future({ months: 6 }),
      is_active: faker.datatype.boolean({ probability: 0.9 }), // 90% active
      created_at: faker.date.past({ years: 2 }),
      updated_at: faker.date.recent({ days: 30 }),
      notes: faker.lorem.sentence(),
      manufacturer: faker.company.name(),
      model: faker.vehicle.model(),
      ...overrides
    } as Equipment;
  }

  static createEquipmentList(count: number, overrides: Partial<Equipment> = {}): Equipment[] {
    return Array.from({ length: count }, () => this.createEquipment(overrides));
  }

  // User Factory
  static createUser(overrides: Partial<User> = {}): User {
    const id = this.getNextId();
    const role = faker.helpers.arrayElement(Object.values(USER_ROLES));

    return {
      id,
      username: faker.internet.username(),
      email: faker.internet.email(),
      password: faker.internet.password({ length: 12 }),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      role,
      is_active: faker.datatype.boolean({ probability: 0.95 }), // 95% active
      last_login: faker.date.recent({ days: 7 }),
      failed_login_attempts: faker.number.int({ min: 0, max: 3 }),
      locked_until: faker.datatype.boolean({ probability: 0.1 }) ? faker.date.future({ hours: 24 }) : null,
      created_at: faker.date.past({ years: 1 }),
      updated_at: faker.date.recent({ days: 30 }),
      phone: faker.phone.number(),
      department: faker.helpers.arrayElement(['Library', 'IT', 'Administration', 'Academics']),
      profile_image_url: faker.internet.url(),
      two_factor_enabled: faker.datatype.boolean({ probability: 0.3 }),
      two_factor_secret: faker.datatype.boolean({ probability: 0.3 }) ? faker.string.alphanumeric({ length: 32 }) : null,
      ...overrides
    } as User;
  }

  static createUsers(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  // Student Activity Factory
  static createStudentActivity(overrides: Partial<StudentActivity> = {}): StudentActivity {
    const id = this.getNextId();
    const activityType = faker.helpers.arrayElement(Object.values(ACTIVITY_TYPES));
    const status = activityType === 'CHECK_IN' ? 'ACTIVE' : faker.helpers.arrayElement(Object.values(ACTIVITY_STATUS));

    return {
      id,
      student_id: this.getNextId(),
      activity_type: activityType,
      status,
      start_time: faker.date.recent({ hours: 24 }),
      end_time: status === 'COMPLETED' ? faker.date.recent({ hours: 12 }) : null,
      notes: faker.lorem.sentence(),
      created_at: faker.date.recent({ days: 1 }),
      updated_at: faker.date.recent({ hours: 1 }),
      book_id: activityType.includes('BOOK') ? this.getNextId() : null,
      equipment_id: activityType.includes('EQUIPMENT') ? this.getNextId() : null,
      user_id: this.getNextId(),
      duration_minutes: status === 'COMPLETED' ? faker.number.int({ min: 15, max: 180 }) : null,
      purpose: faker.lorem.words({ min: 1, max: 3 }),
      ...overrides
    } as StudentActivity;
  }

  static createStudentActivities(count: number, overrides: Partial<StudentActivity> = {}): StudentActivity[] {
    return Array.from({ length: count }, () => this.createStudentActivity(overrides));
  }

  // Book Checkout Factory
  static createBookCheckout(overrides: Partial<BookCheckout> = {}): BookCheckout {
    const id = this.getNextId();
    const status = faker.helpers.arrayElement(['ACTIVE', 'RETURNED', 'OVERDUE']);

    return {
      id,
      student_id: this.getNextId(),
      book_id: this.getNextId(),
      checkout_date: faker.date.past({ days: 14 }),
      due_date: faker.date.future({ days: 7 }),
      return_date: status === 'RETURNED' ? faker.date.recent({ days: 1 }) : null,
      status,
      fine_amount: status === 'OVERDUE' ? faker.number.float({ min: 5, max: 50, fractionDigits: 2 }) : 0,
      notes: faker.lorem.sentence(),
      created_at: faker.date.past({ days: 14 }),
      updated_at: faker.date.recent({ hours: 1 }),
      librarian_id: this.getNextId(),
      renewal_count: faker.number.int({ min: 0, max: 2 }),
      ...overrides
    } as BookCheckout;
  }

  static createBookCheckouts(count: number, overrides: Partial<BookCheckout> = {}): BookCheckout[] {
    return Array.from({ length: count }, () => this.createBookCheckout(overrides));
  }

  // Barcode History Factory
  static createBarcodeHistory(overrides: Partial<BarcodeHistory> = {}): BarcodeHistory {
    const id = this.getNextId();

    return {
      id,
      student_id: this.getNextId(),
      barcode_type: faker.helpers.arrayElement(['STUDENT', 'BOOK', 'EQUIPMENT']),
      barcode_value: faker.string.alphanumeric({ length: 12 }).toUpperCase(),
      scan_time: faker.date.recent({ hours: 24 }),
      action: faker.helpers.arrayElement(['GENERATED', 'SCANNED', 'UPDATED']),
      created_at: faker.date.recent({ days: 7 }),
      updated_at: faker.date.recent({ hours: 1 }),
      user_id: this.getNextId(),
      ...overrides
    } as BarcodeHistory;
  }

  static createBarcodeHistories(count: number, overrides: Partial<BarcodeHistory> = {}): BarcodeHistory[] {
    return Array.from({ length: count }, () => this.createBarcodeHistory(overrides));
  }

  // Audit Log Factory
  static createAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
    const id = this.getNextId();

    return {
      id,
      user_id: this.getNextId(),
      action: faker.helpers.arrayElement([
        'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'IMPORT', 'LOGIN', 'LOGOUT'
      ]),
      table_name: faker.helpers.arrayElement([
        'students', 'books', 'equipment', 'users', 'student_activities', 'book_checkouts'
      ]),
      record_id: this.getNextId(),
      old_values: faker.datatype.boolean({ probability: 0.5 }) ? JSON.stringify(faker.lorem.words()) : null,
      new_values: faker.datatype.boolean({ probability: 0.8 }) ? JSON.stringify(faker.lorem.words()) : null,
      ip_address: faker.internet.ip(),
      user_agent: faker.internet.userAgent(),
      created_at: faker.date.recent({ days: 30 }),
      ...overrides
    } as AuditLog;
  }

  static createAuditLogs(count: number, overrides: Partial<AuditLog> = {}): AuditLog[] {
    return Array.from({ length: count }, () => this.createAuditLog(overrides));
  }

  // Notification Factory
  static createNotification(overrides: Partial<Notification> = {}): Notification {
    const id = this.getNextId();

    return {
      id,
      user_id: this.getNextId(),
      title: faker.lorem.words({ min: 3, max: 6 }).replace(/\b\w/g, l => l.toUpperCase()),
      message: faker.lorem.sentences({ min: 1, max: 3 }),
      type: faker.helpers.arrayElement(['INFO', 'WARNING', 'ERROR', 'SUCCESS']),
      priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      is_read: faker.datatype.boolean({ probability: 0.7 }), // 70% read
      created_at: faker.date.recent({ days: 7 }),
      updated_at: faker.date.recent({ hours: 1 }),
      read_at: faker.datatype.boolean({ probability: 0.5 }) ? faker.date.recent({ hours: 6 }) : null,
      action_url: faker.datatype.boolean({ probability: 0.3 }) ? faker.internet.url() : null,
      expires_at: faker.datatype.boolean({ probability: 0.2 }) ? faker.date.future({ days: 7 }) : null,
      ...overrides
    } as Notification;
  }

  static createNotifications(count: number, overrides: Partial<Notification> = {}): Notification[] {
    return Array.from({ length: count }, () => this.createNotification(overrides));
  }

  // Reset counter for consistent test results
  static resetCounter(): void {
    this.counter = 0;
  }

  // Create complete test dataset
  static createTestDataset(): {
    students: Student[];
    books: Book[];
    equipment: Equipment[];
    users: User[];
    activities: StudentActivity[];
    checkouts: BookCheckout[];
    barcodeHistories: BarcodeHistory[];
    auditLogs: AuditLog[];
    notifications: Notification[];
  } {
    this.resetCounter();

    const students = this.createStudents(20);
    const books = this.createBooks(50);
    const equipment = this.createEquipmentList(15);
    const users = this.createUsers(10);
    const activities = this.createStudentActivities(100);
    const checkouts = this.createBookCheckouts(30);
    const barcodeHistories = this.createBarcodeHistories(200);
    const auditLogs = this.createAuditLogs(500);
    const notifications = this.createNotifications(25);

    return {
      students,
      books,
      equipment,
      users,
      activities,
      checkouts,
      barcodeHistories,
      auditLogs,
      notifications
    };
  }
}

// Utility functions for testing
export const mockDate = (date: Date): void => {
  vi.setSystemTime(date);
};

export const resetMockDate = (): void => {
  vi.useRealTimers();
};

export const createMockContext = () => ({
  req: {
    user: { id: '1', role: USER_ROLES.LIBRARIAN },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' }
  },
  res: {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  }
});

export const expectValidationError = (error: any, field: string): void => {
  expect(error).toBeDefined();
  expect(error.message).toContain(field);
};