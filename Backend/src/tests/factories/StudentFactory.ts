import { faker } from '@faker-js/faker';
import type { students, students_grade_category, Prisma } from '@prisma/client';
import { BaseFactory } from './BaseFactory';

/**
 * Student Factory
 * 
 * Generates valid student data with proper grade categories, sections,
 * and realistic student information that matches the database schema.
 */
export class StudentFactory extends BaseFactory<
  students,
  Prisma.studentsCreateInput,
  Prisma.studentsUpdateInput
> {
  /**
   * Grade level mappings for realistic data generation
   */
  private static readonly GRADE_LEVELS = {
    PRIMARY: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
    JUNIOR_HIGH: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
    SENIOR_HIGH: ['Grade 11', 'Grade 12']
  } as const;

  /**
   * Section patterns for different grade levels
   */
  private static readonly SECTION_PATTERNS = {
    PRIMARY: ['A', 'B', 'C', 'D'],
    JUNIOR_HIGH: ['A', 'B', 'C', 'D', 'E', 'F'],
    SENIOR_HIGH: ['STEM-A', 'STEM-B', 'ABM-A', 'ABM-B', 'HUMSS-A', 'HUMSS-B', 'GAS-A', 'GAS-B']
  } as const;

  /**
   * Create a single student with valid data
   */
  create(overrides: Partial<Prisma.studentsCreateInput> = {}): students {
    const gradeLevel = this.randomGradeLevel();
    const gradeCategory = this.determineGradeCategory(gradeLevel);
    const section = this.generateSection(gradeLevel, gradeCategory);
    const studentId = BaseFactory.generateStudentId(gradeLevel);
    const timestamps = BaseFactory.generateTimestamps({ ageInDays: faker.number.int({ min: 30, max: 730 }) });

    const baseData: Prisma.studentsCreateInput = {
      id: BaseFactory.getNextId('student'),
      student_id: studentId,
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      grade_level: gradeLevel,
      grade_category: gradeCategory,
      section: section,
      is_active: BaseFactory.randomBoolean(0.95), // 95% active students
      created_at: timestamps.created_at,
      updated_at: timestamps.updated_at,
      equipment_ban: BaseFactory.randomBoolean(0.05), // 5% equipment ban
      equipment_ban_reason: BaseFactory.randomBoolean(0.05) ? faker.lorem.sentence() : null,
      equipment_ban_until: BaseFactory.randomBoolean(0.03) ? BaseFactory.randomFutureDate({ days: 30 }) : null,
      fine_balance: BaseFactory.randomFloat(0, 500, 2),
      max_concurrent_reservations: BaseFactory.randomInt(1, 3),
      barcode_image: BaseFactory.randomBoolean(0.8) ? `barcode_${studentId}.png` : null,
    };

    const finalData = BaseFactory.applyOverrides(baseData, overrides);

    // Validate required fields
    BaseFactory.validateData(finalData, [
      'id', 'student_id', 'first_name', 'last_name', 'grade_level', 'grade_category'
    ]);

    return finalData as students;
  }

  /**
   * Create students with specific grade level
   */
  createWithGradeLevel(gradeLevel: string, count: number = 1): students[] {
    return this.createMany(count, { grade_level: gradeLevel });
  }

  /**
   * Create students with specific grade category
   */
  createWithGradeCategory(
    gradeCategory: students_grade_category,
    count: number = 1
  ): students[] {
    const gradeLevels = this.getGradeLevelsForCategory(gradeCategory);
    return this.createManyWithVariations(count, 
      gradeLevels.map(gradeLevel => ({ grade_level: gradeLevel, grade_category }))
    );
  }

  /**
   * Create students with equipment bans
   */
  createWithEquipmentBan(count: number = 1): students[] {
    return this.createMany(count, {
      equipment_ban: true,
      equipment_ban_reason: faker.lorem.sentence(),
      equipment_ban_until: BaseFactory.randomFutureDate({ days: faker.number.int({ min: 7, max: 90 }) })
    });
  }

  /**
   * Create students with outstanding fines
   */
  createWithFines(count: number = 1): students[] {
    return this.createMany(count, {
      fine_balance: BaseFactory.randomFloat(50, 500, 2)
    });
  }

  /**
   * Create inactive students
   */
  createInactive(count: number = 1): students[] {
    return this.createMany(count, {
      is_active: false
    });
  }

  /**
   * Create a diverse set of students across all grade levels
   */
  createDiverseSet(count: number = 50): students[] {
    const distribution = {
      PRIMARY: Math.floor(count * 0.4),    // 40% primary
      JUNIOR_HIGH: Math.floor(count * 0.35), // 35% junior high
      SENIOR_HIGH: Math.floor(count * 0.25)  // 25% senior high
    };

    const students: students[] = [];

    Object.entries(distribution).forEach(([category, categoryCount]) => {
      students.push(...this.createWithGradeCategory(
        category as students_grade_category,
        categoryCount
      ));
    });

    return students;
  }

  /**
   * Create students for specific sections
   */
  createForSection(section: string, count: number = 1): students[] {
    return this.createMany(count, { section });
  }

  /**
   * Create students with realistic names for Filipino context
   */
  createWithFilipinoNames(count: number = 1): students[] {
    const filipinoFirstNames = [
      'Juan', 'Jose', 'Maria', 'Ana', 'Sofia', 'Miguel', 'Gabriel', 'Andrea',
      'Carlos', 'Patricia', 'Roberto', 'Carmen', 'Antonio', 'Rosa', 'Francisco', 'Luisa'
    ];

    const filipinoLastNames = [
      'Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Flores', 'Torres', 'Ramos',
      'Rivera', 'Castillo', 'Vargas', 'Del Rosario', 'Aquino', 'Fernando', 'Villanueva', 'De Leon'
    ];

    return this.createMany(count, {
      first_name: () => faker.helpers.arrayElement(filipinoFirstNames),
      last_name: () => faker.helpers.arrayElement(filipinoLastNames)
    });
  }

  /**
   * Generate a random grade level
   */
  private randomGradeLevel(): string {
    const allGradeLevels = [
      ...StudentFactory.GRADE_LEVELS.PRIMARY,
      ...StudentFactory.GRADE_LEVELS.JUNIOR_HIGH,
      ...StudentFactory.GRADE_LEVELS.SENIOR_HIGH
    ];
    return BaseFactory.randomEnum(allGradeLevels);
  }

  /**
   * Determine grade category based on grade level
   */
  private determineGradeCategory(gradeLevel: string): students_grade_category {
    if (StudentFactory.GRADE_LEVELS.PRIMARY.includes(gradeLevel)) {
      return students_grade_category.PRIMARY;
    } else if (StudentFactory.GRADE_LEVELS.JUNIOR_HIGH.includes(gradeLevel)) {
      return students_grade_category.JUNIOR_HIGH;
    } else if (StudentFactory.GRADE_LEVELS.SENIOR_HIGH.includes(gradeLevel)) {
      return students_grade_category.SENIOR_HIGH;
    } else if (StudentFactory.GRADE_LEVELS.GRADE_SCHOOL.includes(gradeLevel)) {
      return students_grade_category.GRADE_SCHOOL;
    }
    
    // Default to JUNIOR_HIGH if grade level is not recognized
    return students_grade_category.JUNIOR_HIGH;
  }

  /**
   * Generate appropriate section for grade level and category
   */
  private generateSection(gradeLevel: string, gradeCategory: students_grade_category): string {
    let patterns: string[];

    switch (gradeCategory) {
      case students_grade_category.PRIMARY:
        patterns = StudentFactory.SECTION_PATTERNS.PRIMARY;
        break;
      case students_grade_category.JUNIOR_HIGH:
        patterns = StudentFactory.SECTION_PATTERNS.JUNIOR_HIGH;
        break;
      case students_grade_category.SENIOR_HIGH:
        patterns = StudentFactory.SECTION_PATTERNS.SENIOR_HIGH;
        break;
      default:
        patterns = StudentFactory.SECTION_PATTERNS.JUNIOR_HIGH;
    }

    const pattern = BaseFactory.randomEnum(patterns);
    
    // For simple sections (A, B, C, etc.), add grade number
    if (pattern.length === 1) {
      const gradeNumber = gradeLevel.replace(/[^0-9]/g, '');
      return `${gradeNumber}-${pattern}`;
    }

    return pattern;
  }

  /**
   * Get grade levels for a specific category
   */
  private getGradeLevelsForCategory(category: students_grade_category): string[] {
    switch (category) {
      case students_grade_category.PRIMARY:
        return [...StudentFactory.GRADE_LEVELS.PRIMARY];
      case students_grade_category.JUNIOR_HIGH:
        return [...StudentFactory.GRADE_LEVELS.JUNIOR_HIGH];
      case students_grade_category.SENIOR_HIGH:
        return [...StudentFactory.GRADE_LEVELS.SENIOR_HIGH];
      case students_grade_category.GRADE_SCHOOL:
        return [...StudentFactory.GRADE_LEVELS.PRIMARY, ...StudentFactory.GRADE_LEVELS.JUNIOR_HIGH];
      default:
        return [...StudentFactory.GRADE_LEVELS.JUNIOR_HIGH];
    }
  }

  /**
   * Create students with specific time-based scenarios
   */
  createWithTimeScenarios(): {
    newStudents: students[];
    existingStudents: students[];
    graduatingStudents: students[];
  } {
    const now = new Date();
    const currentYear = now.getFullYear();

    // New students (enrolled this month)
    const newStudents = this.createMany(5, {
      created_at: BaseFactory.randomRecentDate({ days: 30 }),
      updated_at: BaseFactory.randomRecentDate({ hours: 24 })
    });

    // Existing students (enrolled previous years)
    const existingStudents = this.createMany(15, {
      created_at: BaseFactory.randomPastDate({ years: 1 }),
      updated_at: BaseFactory.randomRecentDate({ days: 7 })
    });

    // Graduating students (Grade 12)
    const graduatingStudents = this.createMany(3, {
      grade_level: 'Grade 12',
      grade_category: students_grade_category.SENIOR_HIGH,
      created_at: faker.date.past({ years: 6 }),
      updated_at: BaseFactory.randomRecentDate({ days: 3 })
    });

    return {
      newStudents,
      existingStudents,
      graduatingStudents
    };
  }

  /**
   * Create students with realistic activity patterns
   */
  createWithActivityPatterns(): {
    activeStudents: students[];
    inactiveStudents: students[];
    bannedStudents: students[];
    studentsWithFines: students[];
  } {
    return {
      activeStudents: this.createMany(20, {
        is_active: true,
        equipment_ban: false,
        fine_balance: 0
      }),
      inactiveStudents: this.createInactive(5),
      bannedStudents: this.createWithEquipmentBan(3),
      studentsWithFines: this.createWithFines(8)
    };
  }
}