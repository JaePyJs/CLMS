import { faker } from '@faker-js/faker';
import type { book_checkouts, book_checkouts_status, Prisma } from '@prisma/client';
import { BaseFactory } from './BaseFactory';

/**
 * Book Checkout Factory
 * 
 * Generates valid book checkout records with realistic dates,
 * fine calculations, and proper checkout status that matches the database schema.
 */
export class CheckoutFactory extends BaseFactory<
  book_checkouts,
  Prisma.book_checkoutsCreateInput,
  Prisma.book_checkoutsUpdateInput
> {
  /**
   * Standard checkout periods in days
   */
  private static readonly CHECKOUT_PERIODS = {
    STUDENT: 7,      // 7 days for regular students
    FACULTY: 14,     // 14 days for faculty
    REFERENCE: 3,    // 3 days for reference materials
    RESERVED: 2      // 2 days for reserved books
  } as const;

  /**
   * Fine rates per day
   */
  private static readonly FINE_RATES = {
    REGULAR: 5.00,   // ₱5.00 per day
    PREMIUM: 10.00,  // ₱10.00 per day for premium books
    MAXIMUM: 500.00  // Maximum fine amount
  } as const;

  /**
   * Create a single book checkout with valid data
   */
  create(overrides: Partial<Prisma.book_checkoutsCreateInput> = {}): book_checkouts {
    const status = BaseFactory.randomEnum(Object.values(book_checkouts_status));
    const checkoutDate = BaseFactory.randomPastDate({ days: 30 });
    const dueDate = this.calculateDueDate(checkoutDate);
    const returnDate = this.calculateReturnDate(status, checkoutDate, dueDate);
    const timestamps = BaseFactory.generateTimestamps({
      createdAt: checkoutDate,
      updatedAt: returnDate || BaseFactory.randomRecentDate({ hours: 24 })
    });

    const overdueDays = this.calculateOverdueDays(status, dueDate, returnDate);
    const fineAmount = this.calculateFineAmount(overdueDays);

    const baseData: Prisma.book_checkoutsCreateInput = {
      id: BaseFactory.getNextId('checkout'),
      status: status,
      notes: BaseFactory.randomBoolean(0.3) ? faker.lorem.sentence() : null,
      book_id: BaseFactory.getNextId('book'),
      checkout_date: checkoutDate,
      created_at: timestamps.created_at,
      due_date: dueDate,
      fine_amount: fineAmount,
      fine_paid: status === book_checkouts_status.RETURNED ? BaseFactory.randomBoolean(0.7) : false,
      overdue_days: overdueDays,
      processed_by: this.generateProcessedBy(),
      return_date: returnDate,
      student_id: BaseFactory.getNextId('student'),
      updated_at: timestamps.updated_at,
    };

    const finalData = BaseFactory.applyOverrides(baseData, overrides);

    // Validate required fields
    BaseFactory.validateData(finalData, [
      'id', 'book_id', 'student_id', 'checkout_date', 'due_date', 'status'
    ]);

    return finalData as book_checkouts;
  }

  /**
   * Create active checkouts
   */
  createActive(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      status: book_checkouts_status.ACTIVE,
      return_date: null,
      fine_paid: false
    });
  }

  /**
   * Create returned checkouts
   */
  createReturned(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      status: book_checkouts_status.RETURNED,
      return_date: BaseFactory.randomPastDate({ days: 7 }),
      fine_paid: BaseFactory.randomBoolean(0.8)
    });
  }

  /**
   * Create overdue checkouts
   */
  createOverdue(count: number = 1): book_checkouts[] {
    const checkoutDate = BaseFactory.randomPastDate({ days: 15 });
    const dueDate = faker.date.past({ days: 7, refDate: checkoutDate });

    return this.createMany(count, {
      status: book_checkouts_status.OVERDUE,
      checkout_date: checkoutDate,
      due_date: dueDate,
      return_date: null,
      fine_paid: false,
      overdue_days: BaseFactory.randomInt(1, 30),
      fine_amount: BaseFactory.randomFloat(5, 150, 2)
    });
  }

  /**
   * Create lost books checkouts
   */
  createLost(count: number = 1): book_checkouts[] {
    const checkoutDate = BaseFactory.randomPastDate({ days: 60 });
    const dueDate = faker.date.past({ days: 45, refDate: checkoutDate });

    return this.createMany(count, {
      status: book_checkouts_status.LOST,
      checkout_date: checkoutDate,
      due_date: dueDate,
      return_date: null,
      fine_paid: false,
      overdue_days: BaseFactory.randomInt(30, 90),
      fine_amount: BaseFactory.randomFloat(200, 1000, 2),
      notes: 'Book reported as lost - replacement cost charged'
    });
  }

  /**
   * Create damaged books checkouts
   */
  createDamaged(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      status: book_checkouts_status.DAMAGED,
      return_date: BaseFactory.randomPastDate({ days: 3 }),
      fine_paid: false,
      overdue_days: 0,
      fine_amount: BaseFactory.randomFloat(50, 300, 2),
      notes: 'Book returned with damage - repair cost charged'
    });
  }

  /**
   * Create checkouts with fines
   */
  createWithFines(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      fine_amount: BaseFactory.randomFloat(5, 500, 2),
      fine_paid: false,
      overdue_days: BaseFactory.randomInt(1, 60)
    });
  }

  /**
   * Create checkouts with paid fines
   */
  createWithPaidFines(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      status: book_checkouts_status.RETURNED,
      fine_amount: BaseFactory.randomFloat(5, 200, 2),
      fine_paid: true,
      overdue_days: BaseFactory.randomInt(1, 30)
    });
  }

  /**
   * Create recent checkouts (last 7 days)
   */
  createRecent(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      checkout_date: BaseFactory.randomRecentDate({ days: 7 }),
      created_at: BaseFactory.randomRecentDate({ days: 7 }),
      status: book_checkouts_status.ACTIVE
    });
  }

  /**
   * Create old checkouts (older than 30 days)
   */
  createOld(count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      checkout_date: BaseFactory.randomPastDate({ days: 60 }),
      created_at: BaseFactory.randomPastDate({ days: 60 }),
      status: BaseFactory.randomEnum([
        book_checkouts_status.RETURNED,
        book_checkouts_status.LOST,
        book_checkouts_status.DAMAGED
      ])
    });
  }

  /**
   * Create checkouts for specific student
   */
  createForStudent(studentId: string, count: number = 1): book_checkouts[] {
    return this.createMany(count, { student_id: studentId });
  }

  /**
   * Create checkouts for specific book
   */
  createForBook(bookId: string, count: number = 1): book_checkouts[] {
    return this.createMany(count, { book_id: bookId });
  }

  /**
   * Create checkouts with specific checkout date range
   */
  createInDateRange(startDate: Date, endDate: Date, count: number = 1): book_checkouts[] {
    return this.createMany(count, {
      checkout_date: BaseFactory.randomDate(startDate, endDate),
      created_at: BaseFactory.randomDate(startDate, endDate)
    });
  }

  /**
   * Create a realistic checkout history
   */
  createRealisticHistory(count: number = 100): book_checkouts[] {
    const distribution = {
      [book_checkouts_status.ACTIVE]: Math.floor(count * 0.3),    // 30% active
      [book_checkouts_status.RETURNED]: Math.floor(count * 0.5),  // 50% returned
      [book_checkouts_status.OVERDUE]: Math.floor(count * 0.1),   // 10% overdue
      [book_checkouts_status.LOST]: Math.floor(count * 0.05),     // 5% lost
      [book_checkouts_status.DAMAGED]: Math.floor(count * 0.05)   // 5% damaged
    };

    const checkouts: book_checkouts[] = [];

    Object.entries(distribution).forEach(([status, statusCount]) => {
      switch (status) {
        case book_checkouts_status.ACTIVE:
          checkouts.push(...this.createActive(statusCount));
          break;
        case book_checkouts_status.RETURNED:
          checkouts.push(...this.createReturned(statusCount));
          break;
        case book_checkouts_status.OVERDUE:
          checkouts.push(...this.createOverdue(statusCount));
          break;
        case book_checkouts_status.LOST:
          checkouts.push(...this.createLost(statusCount));
          break;
        case book_checkouts_status.DAMAGED:
          checkouts.push(...this.createDamaged(statusCount));
          break;
      }
    });

    return checkouts;
  }

  /**
   * Create checkouts with fine scenarios
   */
  createWithFineScenarios(): {
    noFines: book_checkouts[];
    smallFines: book_checkouts[];
    mediumFines: book_checkouts[];
    largeFines: book_checkouts[];
    paidFines: book_checkouts[];
    unpaidFines: book_checkouts[];
  } {
    return {
      // No fines (on-time returns or active within due date)
      noFines: this.createMany(20, {
        fine_amount: 0,
        overdue_days: 0,
        status: BaseFactory.randomEnum([
          book_checkouts_status.ACTIVE,
          book_checkouts_status.RETURNED
        ])
      }),

      // Small fines (₱5-₱50)
      smallFines: this.createMany(15, {
        fine_amount: BaseFactory.randomFloat(5, 50, 2),
        overdue_days: BaseFactory.randomInt(1, 10),
        fine_paid: BaseFactory.randomBoolean(0.6)
      }),

      // Medium fines (₱51-₱200)
      mediumFines: this.createMany(10, {
        fine_amount: BaseFactory.randomFloat(51, 200, 2),
        overdue_days: BaseFactory.randomInt(11, 40),
        fine_paid: BaseFactory.randomBoolean(0.4)
      }),

      // Large fines (₱201-₱500)
      largeFines: this.createMany(5, {
        fine_amount: BaseFactory.randomFloat(201, 500, 2),
        overdue_days: BaseFactory.randomInt(41, 100),
        fine_paid: false,
        status: BaseFactory.randomEnum([
          book_checkouts_status.OVERDUE,
          book_checkouts_status.LOST,
          book_checkouts_status.DAMAGED
        ])
      }),

      // Paid fines
      paidFines: this.createMany(12, {
        fine_amount: BaseFactory.randomFloat(5, 300, 2),
        fine_paid: true,
        status: book_checkouts_status.RETURNED
      }),

      // Unpaid fines
      unpaidFines: this.createMany(8, {
        fine_amount: BaseFactory.randomFloat(5, 400, 2),
        fine_paid: false,
        status: BaseFactory.randomEnum([
          book_checkouts_status.ACTIVE,
          book_checkouts_status.OVERDUE,
          book_checkouts_status.LOST
        ])
      })
    };
  }

  /**
   * Create checkouts with time-based patterns
   */
  createWithTimePatterns(): {
    today: book_checkouts[];
    thisWeek: book_checkouts[];
    thisMonth: book_checkouts[];
    lastMonth: book_checkouts[];
    older: book_checkouts[];
  } {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      // Today's checkouts
      today: this.createMany(5, {
        checkout_date: BaseFactory.randomRecentDate({ hours: 24 }),
        created_at: BaseFactory.randomRecentDate({ hours: 24 })
      }),

      // This week's checkouts
      thisWeek: this.createMany(15, {
        checkout_date: BaseFactory.randomDate(weekStart, now),
        created_at: BaseFactory.randomDate(weekStart, now)
      }),

      // This month's checkouts
      thisMonth: this.createMany(25, {
        checkout_date: BaseFactory.randomDate(monthStart, now),
        created_at: BaseFactory.randomDate(monthStart, now)
      }),

      // Last month's checkouts
      lastMonth: this.createMany(20, {
        checkout_date: BaseFactory.randomDate(lastMonthStart, lastMonthEnd),
        created_at: BaseFactory.randomDate(lastMonthStart, lastMonthEnd),
        status: BaseFactory.randomEnum([
          book_checkouts_status.RETURNED,
          book_checkouts_status.LOST,
          book_checkouts_status.DAMAGED
        ])
      }),

      // Older checkouts
      older: this.createMany(10, {
        checkout_date: BaseFactory.randomPastDate({ months: 3 }),
        created_at: BaseFactory.randomPastDate({ months: 3 }),
        status: book_checkouts_status.RETURNED
      })
    };
  }

  /**
   * Calculate due date based on checkout date
   */
  private calculateDueDate(checkoutDate: Date): Date {
    const dueDate = new Date(checkoutDate);
    dueDate.setDate(dueDate.getDate() + CheckoutFactory.CHECKOUT_PERIODS.STUDENT);
    return dueDate;
  }

  /**
   * Calculate return date based on status and dates
   */
  private calculateReturnDate(
    status: book_checkouts_status,
    checkoutDate: Date,
    dueDate: Date
  ): Date | null {
    switch (status) {
      case book_checkouts_status.RETURNED:
      case book_checkouts_status.DAMAGED:
        return BaseFactory.randomDate(dueDate, new Date());
      case book_checkouts_status.ACTIVE:
      case book_checkouts_status.OVERDUE:
      case book_checkouts_status.LOST:
        return null;
      default:
        return null;
    }
  }

  /**
   * Calculate overdue days
   */
  private calculateOverdueDays(
    status: book_checkouts_status,
    dueDate: Date,
    returnDate: Date | null
  ): number {
    if (status === book_checkouts_status.ACTIVE || status === book_checkouts_status.OVERDUE) {
      const now = new Date();
      const overdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, overdue);
    }

    if (returnDate && returnDate > dueDate) {
      return Math.floor((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return 0;
  }

  /**
   * Calculate fine amount based on overdue days
   */
  private calculateFineAmount(overdueDays: number): number {
    if (overdueDays <= 0) return 0;
    
    const fine = overdueDays * CheckoutFactory.FINE_RATES.REGULAR;
    return Math.min(fine, CheckoutFactory.FINE_RATES.MAXIMUM);
  }

  /**
   * Generate processed by field
   */
  private generateProcessedBy(): string {
    const processors = ['Sophia', 'Admin', 'Librarian', 'System', 'Auto'];
    return BaseFactory.randomEnum(processors);
  }
}