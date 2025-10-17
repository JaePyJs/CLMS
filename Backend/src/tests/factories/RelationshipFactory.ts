import { faker } from '@faker-js/faker';
import type { 
  students, 
  books, 
  equipment, 
  users, 
  book_checkouts,
  equipment_reservations,
  student_activities
} from '@prisma/client';
import { StudentFactory } from './StudentFactory';
import { BookFactory } from './BookFactory';
import { EquipmentFactory } from './EquipmentFactory';
import { UserFactory } from './UserFactory';
import { CheckoutFactory } from './CheckoutFactory';
import { BaseFactory } from './BaseFactory';

/**
 * Relationship Factory
 * 
 * Creates interconnected test data with realistic relationships between entities.
 * This factory ensures referential integrity and creates meaningful test scenarios.
 */
export class RelationshipFactory {
  private studentFactory = new StudentFactory();
  private bookFactory = new BookFactory();
  private equipmentFactory = new EquipmentFactory();
  private userFactory = new UserFactory();
  private checkoutFactory = new CheckoutFactory();

  /**
   * Reset all factory counters for consistent test results
   */
  resetAll(): void {
    BaseFactory.resetAllCounters();
  }

  /**
   * Create a complete library ecosystem with interconnected entities
   */
  async createCompleteEcosystem(options: {
    studentCount?: number;
    bookCount?: number;
    equipmentCount?: number;
    userCount?: number;
    checkoutCount?: number;
  } = {}): Promise<{
    students: students[];
    books: books[];
    equipment: equipment[];
    users: users[];
    checkouts: book_checkouts[];
    activities: student_activities[];
    stats: {
      activeStudents: number;
      availableBooks: number;
      availableEquipment: number;
      activeCheckouts: number;
      overdueItems: number;
    };
  }> {
    const {
      studentCount = 50,
      bookCount = 100,
      equipmentCount = 30,
      userCount = 10,
      checkoutCount = 75
    } = options;

    // Create base entities
    const students = this.studentFactory.createDiverseSet(studentCount);
    const books = this.bookFactory.createDiverseCollection(bookCount);
    const equipment = this.equipmentFactory.createDiverseInventory(equipmentCount);
    const users = await this.userFactory.createCompleteHierarchy();

    // Create interconnected checkouts
    const checkouts = this.createInterconnectedCheckouts(
      students,
      books,
      users.librarians[0],
      checkoutCount
    );

    // Create student activities
    const activities = this.createStudentActivities(students, equipment, books);

    // Calculate statistics
    const stats = {
      activeStudents: students.filter(s => s.is_active).length,
      availableBooks: books.filter(b => b.is_active && b.available_copies > 0).length,
      availableEquipment: equipment.filter(e => e.is_active && e.status === 'AVAILABLE').length,
      activeCheckouts: checkouts.filter(c => c.status === 'ACTIVE').length,
      overdueItems: checkouts.filter(c => c.status === 'OVERDUE').length
    };

    return {
      students,
      books,
      equipment,
      users: Object.values(users).flat(),
      checkouts,
      activities,
      stats
    };
  }

  /**
   * Create interconnected checkouts with realistic relationships
   */
  private createInterconnectedCheckouts(
    students: students[],
    books: books[],
    librarian: users,
    count: number
  ): book_checkouts[] {
    const checkouts: book_checkouts[] = [];
    const activeStudents = students.filter(s => s.is_active);
    const availableBooks = books.filter(b => b.is_active && b.total_copies > 0);

    for (let i = 0; i < count && i < availableBooks.length * 2; i++) {
      const student = BaseFactory.randomEnum(activeStudents);
      const book = BaseFactory.randomEnum(availableBooks);

      // Create checkout with realistic relationships
      const checkout = this.checkoutFactory.create({
        student_id: student.id,
        book_id: book.id,
        processed_by: librarian.id || 'librarian',
        status: this.determineCheckoutStatus(student, book)
      });

      checkouts.push(checkout);

      // Update book availability
      if (checkout.status === 'ACTIVE') {
        book.available_copies = Math.max(0, book.available_copies - 1);
      }
    }

    return checkouts;
  }

  /**
   * Create student activities linked to equipment and books
   */
  private createStudentActivities(
    students: students[],
    equipment: equipment[],
    books: books[]
  ): student_activities[] {
    const activities: student_activities[] = [];
    const activeStudents = students.filter(s => s.is_active);
    const availableEquipment = equipment.filter(e => e.is_active);
    const activeCheckouts = books.filter(b => b.available_copies < b.total_copies);

    // Create equipment usage activities
    activeStudents.slice(0, Math.min(20, activeStudents.length)).forEach(student => {
      if (student.equipment_ban) return;

      const equip = BaseFactory.randomEnum(availableEquipment);
      activities.push({
        id: BaseFactory.getNextId('activity'),
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        grade_level: student.grade_level,
        grade_category: student.grade_category,
        activity_type: 'COMPUTER_USE',
        equipment_id: equip.id,
        start_time: BaseFactory.randomRecentDate({ hours: 24 }),
        end_time: BaseFactory.randomRecentDate({ hours: 1 }),
        duration_minutes: BaseFactory.randomInt(30, 120),
        time_limit_minutes: equip.max_time_minutes,
        status: 'COMPLETED',
        notes: faker.lorem.sentence(),
        processed_by: 'System',
        google_synced: false,
        sync_attempts: 0,
        created_at: BaseFactory.randomRecentDate({ days: 1 }),
        updated_at: BaseFactory.randomRecentDate({ hours: 1 })
      } as student_activities);
    });

    // Create book checkout activities
    activeCheckouts.slice(0, Math.min(15, activeCheckouts.length)).forEach(book => {
      activities.push({
        id: BaseFactory.getNextId('activity'),
        student_id: BaseFactory.randomEnum(activeStudents).id,
        student_name: faker.person.fullName(),
        grade_level: BaseFactory.randomEnum(activeStudents).grade_level,
        grade_category: BaseFactory.randomEnum(activeStudents).grade_category,
        activity_type: 'BOOK_CHECKOUT',
        checkout_id: BaseFactory.getNextId('checkout'),
        book_id: book.id,
        start_time: BaseFactory.randomRecentDate({ hours: 48 }),
        end_time: null,
        duration_minutes: null,
        time_limit_minutes: null,
        status: 'ACTIVE',
        notes: 'Book checked out for regular use',
        processed_by: 'Librarian',
        google_synced: false,
        sync_attempts: 0,
        created_at: BaseFactory.randomRecentDate({ days: 2 }),
        updated_at: BaseFactory.randomRecentDate({ hours: 24 })
      } as student_activities);
    });

    return activities;
  }

  /**
   * Determine checkout status based on student and book properties
   */
  private determineCheckoutStatus(student: students, book: books): string {
    if (student.equipment_ban && BaseFactory.randomBoolean(0.7)) {
      return 'OVERDUE';
    }

    if (student.fine_balance > 100 && BaseFactory.randomBoolean(0.5)) {
      return 'OVERDUE';
    }

    const statusOptions = ['ACTIVE', 'RETURNED', 'OVERDUE'];
    const weights = [0.6, 0.3, 0.1]; // 60% active, 30% returned, 10% overdue

    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < statusOptions.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return statusOptions[i];
      }
    }

    return 'ACTIVE';
  }

  /**
   * Create a realistic library workflow scenario
   */
  async createLibraryWorkflowScenario(): Promise<{
    scenario: string;
    data: {
      newStudents: students[];
      existingStudents: students[];
      librarian: users;
      newBooks: books[];
      checkouts: book_checkouts[];
      overdueNotices: any[];
      equipmentUsage: student_activities[];
    };
    timeline: any[];
  }> {
    this.resetAll();

    // Create staff
    const librarian = await this.userFactory.createLibrarian({
      full_name: 'Maria Santos',
      username: 'maria.santos'
    });

    // Create students (new and existing)
    const newStudents = this.studentFactory.createWithTimeScenarios().newStudents;
    const existingStudents = this.studentFactory.createWithTimeScenarios().existingStudents;
    const allStudents = [...newStudents, ...existingStudents];

    // Create new book acquisitions
    const newBooks = this.bookFactory.createNewArrivals(15);

    // Create realistic checkout flow
    const checkouts: book_checkouts[] = [];

    // Day 1: New students check out books
    newStudents.slice(0, 5).forEach((student, index) => {
      const book = newBooks[index];
      checkouts.push(this.checkoutFactory.create({
        student_id: student.id,
        book_id: book.id,
        processed_by: librarian.id,
        status: 'ACTIVE',
        checkout_date: new Date(),
        notes: 'First-time borrower'
      }));
    });

    // Day 7: Some books become overdue
    checkouts.slice(0, 3).forEach(checkout => {
      checkouts.push(this.checkoutFactory.create({
        student_id: checkout.student_id,
        book_id: checkout.book_id,
        processed_by: librarian.id,
        status: 'OVERDUE',
        checkout_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        overdue_days: 3,
        fine_amount: 15.00
      }));
    });

    // Create overdue notices
    const overdueNotices = checkouts
      .filter(c => c.status === 'OVERDUE')
      .map(checkout => ({
        id: BaseFactory.getNextId('notice'),
        student_id: checkout.student_id,
        checkout_id: checkout.id,
        type: 'OVERDUE_NOTICE',
        message: `Your book is overdue by ${checkout.overdue_days} days. Fine: ₱${checkout.fine_amount}`,
        created_at: new Date(),
        sent_via: 'email'
      }));

    // Create equipment usage activities
    const equipmentUsage = allStudents.slice(0, 10).map(student => ({
      id: BaseFactory.getNextId('activity'),
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      grade_level: student.grade_level,
      grade_category: student.grade_category,
      activity_type: 'COMPUTER_USE',
      equipment_id: BaseFactory.getNextId('equipment'),
      start_time: BaseFactory.randomRecentDate({ hours: 24 }),
      end_time: BaseFactory.randomRecentDate({ hours: 1 }),
      duration_minutes: BaseFactory.randomInt(30, 90),
      status: 'COMPLETED',
      processed_by: 'System',
      created_at: BaseFactory.randomRecentDate({ days: 1 }),
      updated_at: BaseFactory.randomRecentDate({ hours: 1 })
    } as student_activities));

    // Create timeline of events
    const timeline = [
      {
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        event: 'New book acquisitions processed',
        details: `${newBooks.length} books added to collection`
      },
      {
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        event: 'Student registration',
        details: `${newStudents.length} new students registered`
      },
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        event: 'Book checkout peak',
        details: `${checkouts.filter(c => c.status === 'ACTIVE').length} active checkouts`
      },
      {
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        event: 'Overdue notices sent',
        details: `${overdueNotices.length} overdue notices generated`
      },
      {
        date: new Date(),
        event: 'Equipment usage summary',
        details: `${equipmentUsage.length} equipment sessions completed`
      }
    ];

    return {
      scenario: 'Library Workflow - First Month Operations',
      data: {
        newStudents,
        existingStudents,
        librarian,
        newBooks,
        checkouts,
        overdueNotices,
        equipmentUsage
      },
      timeline
    };
  }

  /**
   * Create stress test data with high volume relationships
   */
  async createStressTestData(scale: 'small' | 'medium' | 'large' = 'medium'): Promise<{
    scale: string;
    entities: {
      students: students[];
      books: books[];
      equipment: equipment[];
      users: users[];
      checkouts: book_checkouts[];
      activities: student_activities[];
    };
    performance: {
      totalRecords: number;
      relationships: number;
      complexity: string;
    };
  }> {
    const scales = {
      small: { students: 100, books: 200, equipment: 50, users: 5, checkouts: 300 },
      medium: { students: 500, books: 1000, equipment: 100, users: 10, checkouts: 1500 },
      large: { students: 2000, books: 5000, equipment: 200, users: 20, checkouts: 7500 }
    };

    const config = scales[scale];

    // Create entities
    const students = this.studentFactory.createDiverseSet(config.students);
    const books = this.bookFactory.createDiverseCollection(config.books);
    const equipment = this.equipmentFactory.createDiverseInventory(config.equipment);
    const users = await this.userFactory.createCompleteHierarchy();

    // Create high-volume checkouts
    const checkouts: book_checkouts[] = [];
    const activeStudents = students.filter(s => s.is_active);
    const availableBooks = books.filter(b => b.is_active);

    for (let i = 0; i < config.checkouts; i++) {
      const student = BaseFactory.randomEnum(activeStudents);
      const book = BaseFactory.randomEnum(availableBooks);
      const librarian = BaseFactory.randomEnum([...users.admins, ...users.librarians]);

      checkouts.push(this.checkoutFactory.create({
        student_id: student.id,
        book_id: book.id,
        processed_by: librarian.id
      }));
    }

    // Create activities
    const activities: student_activities[] = [];
    const availableEquipment = equipment.filter(e => e.is_active);

    for (let i = 0; i < Math.floor(config.students * 0.3); i++) {
      const student = BaseFactory.randomEnum(activeStudents);
      const equip = BaseFactory.randomEnum(availableEquipment);

      activities.push({
        id: BaseFactory.getNextId('activity'),
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        grade_level: student.grade_level,
        grade_category: student.grade_category,
        activity_type: 'COMPUTER_USE',
        equipment_id: equip.id,
        start_time: BaseFactory.randomRecentDate({ hours: 24 }),
        end_time: BaseFactory.randomRecentDate({ hours: 1 }),
        duration_minutes: BaseFactory.randomInt(30, 120),
        status: 'COMPLETED',
        processed_by: 'System',
        created_at: BaseFactory.randomRecentDate({ days: 1 }),
        updated_at: BaseFactory.randomRecentDate({ hours: 1 })
      } as student_activities);
    }

    const totalRecords = students.length + books.length + equipment.length + 
                        Object.values(users).flat().length + checkouts.length + activities.length;

    return {
      scale,
      entities: {
        students,
        books,
        equipment,
        users: Object.values(users).flat(),
        checkouts,
        activities
      },
      performance: {
        totalRecords,
        relationships: checkouts.length + activities.length,
        complexity: scale === 'large' ? 'High' : scale === 'medium' ? 'Medium' : 'Low'
      }
    };
  }

  /**
   * Create edge case scenarios for testing
   */
  async createEdgeCaseScenarios(): Promise<{
    scenarios: {
      bannedStudents: students[];
      maxedOutCheckouts: book_checkouts[];
      damagedBooks: book_checkouts[];
      equipmentMaintenance: equipment[];
      orphanedRecords: any[];
    };
    description: string;
  }> {
    // Create banned students with checkouts
    const bannedStudents = this.studentFactory.createWithEquipmentBan(5);
    const bannedCheckouts = bannedStudents.map(student => 
      this.checkoutFactory.create({
        student_id: student.id,
        status: 'OVERDUE',
        fine_amount: BaseFactory.randomFloat(100, 500, 2),
        notes: 'Student banned from equipment usage'
      })
    );

    // Create students with maximum checkouts
    const maxedOutStudents = this.studentFactory.createMany(3);
    const maxedOutCheckouts: book_checkouts[] = [];
    
    maxedOutStudents.forEach(student => {
      for (let i = 0; i < 5; i++) { // Maximum 5 checkouts per student
        maxedOutCheckouts.push(this.checkoutFactory.create({
          student_id: student.id,
          status: 'ACTIVE'
        }));
      }
    });

    // Create damaged book scenarios
    const damagedBooks = this.checkoutFactory.createDamaged(3);

    // Create equipment under maintenance
    const equipmentMaintenance = this.equipmentFactory.createUnderMaintenance(5);

    // Create orphaned records (for cleanup testing)
    const orphanedRecords = [
      {
        id: BaseFactory.getNextId('orphaned'),
        table: 'book_checkouts',
        student_id: 'non-existent-student',
        book_id: 'non-existent-book',
        issue: 'Referential integrity violation'
      },
      {
        id: BaseFactory.getNextId('orphaned'),
        table: 'student_activities',
        student_id: 'non-existent-student',
        equipment_id: 'non-existent-equipment',
        issue: 'Missing foreign key references'
      }
    ];

    return {
      scenarios: {
        bannedStudents,
        maxedOutCheckouts,
        damagedBooks,
        equipmentMaintenance,
        orphanedRecords
      },
      description: 'Edge case scenarios for comprehensive testing'
    };
  }
}