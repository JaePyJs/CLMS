import { faker } from '@faker-js/faker';
import type { books, Prisma } from '@prisma/client';
import { BaseFactory } from './BaseFactory';

/**
 * Book Factory
 * 
 * Generates valid book data with realistic ISBNs, categories,
 * and proper book information that matches the database schema.
 */
export class BookFactory extends BaseFactory<
  books,
  Prisma.booksCreateInput,
  Prisma.booksUpdateInput
> {
  /**
   * Realistic book categories for library system
   */
  private static readonly BOOK_CATEGORIES = [
    'Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'History', 'Biography',
    'Reference', 'Technology', 'English', 'Filipino', 'Literature', 'Philosophy',
    'Psychology', 'Sociology', 'Economics', 'Political Science', 'Art', 'Music',
    'Sports', 'Health', 'Religion', 'Mythology', 'Geography', 'Computer Science'
  ] as const;

  /**
   * Realistic subcategories
   */
  private static readonly BOOK_SUBCATEGORIES = {
    'Fiction': ['Novel', 'Short Stories', 'Poetry', 'Drama', 'Mystery', 'Romance', 'Fantasy', 'Sci-Fi'],
    'Non-Fiction': ['Essay', 'Memoir', 'Biography', 'Autobiography', 'Travel', 'Self-Help'],
    'Science': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Astronomy', 'Environmental Science'],
    'Mathematics': ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Trigonometry', 'Arithmetic'],
    'History': ['World History', 'Philippine History', 'Asian History', 'European History', 'American History'],
    'Reference': ['Dictionary', 'Encyclopedia', 'Atlas', 'Thesaurus', 'Almanac', 'Yearbook'],
    'Technology': ['Computer Science', 'Engineering', 'Robotics', 'Artificial Intelligence', 'Web Development'],
    'English': ['Grammar', 'Composition', 'Literature', 'Phonetics', 'Reading', 'Writing'],
    'Filipino': ['Gramatika', 'Panitikan', 'Komposisyon', 'Pagbasa', 'Pagsulat', 'Wika']
  } as const;

  /**
   * Realistic publishers
   */
  private static readonly PUBLISHERS = [
    'National Book Store', 'Anvil Publishing', 'Adarna House', 'New Day Publishers',
    'University of the Philippines Press', 'Ateneo de Manila University Press',
    'Rex Bookstore', 'Vibal Publishing', 'Diwa Learning Systems', 'Phoenix Publishing House',
    'Goodwill Trading', 'C&E Publishing', 'Central Book Supply', 'Mega Textbooks'
  ] as const;

  /**
   * Realistic locations in library
   */
  private static readonly LIBRARY_LOCATIONS = [
    'Fiction Section A', 'Fiction Section B', 'Non-Fiction Section', 'Reference Section',
    'Filipiniana Section', 'Children\'s Section', 'Periodicals Section', 'Reserve Section',
    'Circulation Desk', 'Digital Library', 'Study Area', 'Reading Room'
  ] as const;

  /**
   * Create a single book with valid data
   */
  create(overrides: Partial<Prisma.booksCreateInput> = {}): books {
    const category = BaseFactory.randomEnum(BookFactory.BOOK_CATEGORIES);
    const subcategory = this.getRandomSubcategory(category);
    const accessionNo = BaseFactory.generateAccessionNumber();
    const isbn = BaseFactory.generateISBN();
    const timestamps = BaseFactory.generateTimestamps({ ageInDays: faker.number.int({ min: 1, max: 1825 }) });

    const totalCopies = BaseFactory.randomInt(1, 5);
    const availableCopies = BaseFactory.randomInt(0, totalCopies);

    const baseData: Prisma.booksCreateInput = {
      id: BaseFactory.getNextId('book'),
      accession_no: accessionNo,
      title: this.generateRealisticTitle(category),
      author: this.generateRealisticAuthor(),
      category: category,
      subcategory: subcategory,
      location: BaseFactory.randomEnum(BookFactory.LIBRARY_LOCATIONS),
      publisher: BaseFactory.randomEnum(BookFactory.PUBLISHERS),
      isbn: isbn,
      available_copies: availableCopies,
      total_copies: totalCopies,
      created_at: timestamps.created_at,
      updated_at: timestamps.updated_at,
      is_active: BaseFactory.randomBoolean(0.95), // 95% active books
      cost_price: BaseFactory.randomFloat(150, 2500, 2),
      edition: this.generateEdition(),
      pages: this.generatePages(),
      remarks: BaseFactory.randomBoolean(0.3) ? faker.lorem.sentence() : null,
      source_of_fund: this.generateSourceOfFund(),
      volume: BaseFactory.randomBoolean(0.2) ? `Vol ${BaseFactory.randomInt(1, 5)}` : null,
      year: BaseFactory.randomInt(1990, 2024),
      barcode_image: BaseFactory.randomBoolean(0.8) ? `barcode_${accessionNo}.png` : null,
    };

    const finalData = BaseFactory.applyOverrides(baseData, overrides);

    // Validate required fields
    BaseFactory.validateData(finalData, [
      'id', 'accession_no', 'title', 'author', 'category'
    ]);

    return finalData as books;
  }

  /**
   * Create books with specific category
   */
  createWithCategory(category: string, count: number = 1): books[] {
    return this.createMany(count, { category });
  }

  /**
   * Create books with specific availability status
   */
  createAvailable(count: number = 1): books[] {
    return this.createMany(count, {
      available_copies: () => BaseFactory.randomInt(1, 5),
      total_copies: () => BaseFactory.randomInt(1, 5),
      is_active: true
    });
  }

  /**
   * Create unavailable books (all copies checked out)
   */
  createUnavailable(count: number = 1): books[] {
    return this.createMany(count, {
      available_copies: 0,
      total_copies: () => BaseFactory.randomInt(1, 5),
      is_active: true
    });
  }

  /**
   * Create inactive books (retired or lost)
   */
  createInactive(count: number = 1): books[] {
    return this.createMany(count, {
      is_active: false,
      available_copies: 0
    });
  }

  /**
   * Create reference books
   */
  createReferenceBooks(count: number = 1): books[] {
    return this.createMany(count, {
      category: 'Reference',
      subcategory: BaseFactory.randomEnum(['Dictionary', 'Encyclopedia', 'Atlas', 'Thesaurus']),
      location: 'Reference Section',
      total_copies: 1,
      available_copies: 1,
      is_active: true
    });
  }

  /**
   * Create Filipino books
   */
  createFilipinoBooks(count: number = 1): books[] {
    return this.createMany(count, {
      category: 'Filipino',
      subcategory: BaseFactory.randomEnum(['Gramatika', 'Panitikan', 'Komposisyon', 'Pagbasa']),
      author: this.generateFilipinoAuthor(),
      title: this.generateFilipinoTitle()
    });
  }

  /**
   * Create new arrivals (recently added books)
   */
  createNewArrivals(count: number = 1): books[] {
    return this.createMany(count, {
      created_at: BaseFactory.randomRecentDate({ days: 30 }),
      updated_at: BaseFactory.randomRecentDate({ hours: 24 })
    });
  }

  /**
   * Create popular books (high circulation)
   */
  createPopularBooks(count: number = 1): books[] {
    return this.createMany(count, {
      total_copies: () => BaseFactory.randomInt(3, 10),
      available_copies: 0, // Usually checked out
      category: BaseFactory.randomEnum(['Fiction', 'Science', 'Technology'])
    });
  }

  /**
   * Create a diverse collection across all categories
   */
  createDiverseCollection(count: number = 100): books[] {
    const distribution = {
      'Fiction': Math.floor(count * 0.25),
      'Non-Fiction': Math.floor(count * 0.15),
      'Science': Math.floor(count * 0.15),
      'Mathematics': Math.floor(count * 0.10),
      'Reference': Math.floor(count * 0.10),
      'Filipino': Math.floor(count * 0.10),
      'Technology': Math.floor(count * 0.08),
      'History': Math.floor(count * 0.07)
    };

    const books: books[] = [];

    Object.entries(distribution).forEach(([category, categoryCount]) => {
      books.push(...this.createWithCategory(category, categoryCount));
    });

    return books;
  }

  /**
   * Create books with specific time-based scenarios
   */
  createWithTimeScenarios(): {
    newAcquisitions: books[];
    classicBooks: books[];
    recentlyUpdated: books[];
    oldBooks: books[];
  } {
    const now = new Date();

    // New acquisitions (added this month)
    const newAcquisitions = this.createMany(10, {
      created_at: BaseFactory.randomRecentDate({ days: 30 }),
      updated_at: BaseFactory.randomRecentDate({ hours: 24 }),
      year: BaseFactory.randomInt(2022, 2024)
    });

    // Classic books (published before 2000)
    const classicBooks = this.createMany(15, {
      year: BaseFactory.randomInt(1950, 1999),
      created_at: BaseFactory.randomPastDate({ years: 5 }),
      updated_at: BaseFactory.randomRecentDate({ days: 7 })
    });

    // Recently updated books
    const recentlyUpdated = this.createMany(8, {
      updated_at: BaseFactory.randomRecentDate({ days: 3 }),
      created_at: BaseFactory.randomPastDate({ years: 2 })
    });

    // Old books (in collection for a long time)
    const oldBooks = this.createMany(12, {
      created_at: BaseFactory.randomPastDate({ years: 10 }),
      updated_at: BaseFactory.randomRecentDate({ months: 6 }),
      year: BaseFactory.randomInt(1980, 2010)
    });

    return {
      newAcquisitions,
      classicBooks,
      recentlyUpdated,
      oldBooks
    };
  }

  /**
   * Create books with realistic circulation patterns
   */
  createWithCirculationPatterns(): {
    highCirculation: books[];
    mediumCirculation: books[];
    lowCirculation: books[];
    neverCirculated: books[];
  } {
    return {
      // High circulation books (fiction, popular science)
      highCirculation: this.createMany(20, {
        category: BaseFactory.randomEnum(['Fiction', 'Science', 'Technology']),
        total_copies: () => BaseFactory.randomInt(3, 8),
        available_copies: () => BaseFactory.randomInt(0, 2),
        is_active: true
      }),

      // Medium circulation books (educational materials)
      mediumCirculation: this.createMany(30, {
        category: BaseFactory.randomEnum(['Mathematics', 'History', 'English']),
        total_copies: () => BaseFactory.randomInt(2, 5),
        available_copies: () => BaseFactory.randomInt(1, 3),
        is_active: true
      }),

      // Low circulation books (specialized topics)
      lowCirculation: this.createMany(15, {
        category: BaseFactory.randomEnum(['Philosophy', 'Psychology', 'Economics']),
        total_copies: 1,
        available_copies: 1,
        is_active: true
      }),

      // Never circulated books (new reference materials)
      neverCirculated: this.createMany(10, {
        category: 'Reference',
        total_copies: 1,
        available_copies: 1,
        created_at: BaseFactory.randomRecentDate({ days: 14 }),
        is_active: true
      })
    };
  }

  /**
   * Generate a realistic title based on category
   */
  private generateRealisticTitle(category: string): string {
    const titlePatterns = {
      'Fiction': [
        'The ${adjective} ${noun}',
        '${noun} and ${noun}',
        'A Tale of ${noun}',
        'The ${adjective} ${noun} of ${place}',
        '${person}\'s ${adjective} ${noun}'
      ],
      'Science': [
        'Introduction to ${field}',
        'Advanced ${field}: ${concept}',
        'The ${adjective} ${field} ${noun}',
        '${field}: ${concept} and Applications',
        'Understanding ${field} ${noun}'
      ],
      'Mathematics': [
        '${concept} Mathematics',
        'Advanced ${concept}',
        'Introduction to ${concept}',
        '${concept} Problems and Solutions',
        'The ${adjective} Book of ${concept}'
      ],
      'Reference': [
        'The ${adjective} ${type}',
        '${type} of ${subject}',
        'Complete ${type} for ${subject}',
        '${adjective} ${type} ${noun}',
        'The Ultimate ${type}'
      ],
      'Filipino': [
        'Ang ${adjective} ${noun}',
        '${noun} at ${noun}',
        'Mga ${noun} ng ${place}',
        'Kuwento tungkol sa ${noun}',
        'Ang ${adjective} ${noun} sa ${place}'
      ]
    };

    const patterns = titlePatterns[category as keyof typeof titlePatterns] || titlePatterns['Fiction'];
    const pattern = BaseFactory.randomEnum(patterns);
    
    return pattern
      .replace('${adjective}', faker.helpers.arrayElement(['Great', 'Amazing', 'Wonderful', 'Fantastic', 'Incredible', 'Magnificent']))
      .replace('${noun}', faker.helpers.arrayElement(['Journey', 'Adventure', 'Story', 'Tale', 'Mystery', 'Secret', 'Discovery', 'World']))
      .replace('${place}', faker.helpers.arrayElement(['Earth', 'World', 'Universe', 'Kingdom', 'City', 'Land']))
      .replace('${person}', faker.person.firstName())
      .replace('${field}', faker.helpers.arrayElement(['Science', 'Physics', 'Chemistry', 'Biology', 'Mathematics']))
      .replace('${concept}', faker.helpers.arrayElement(['Theory', 'Principles', 'Fundamentals', 'Concepts', 'Methods']))
      .replace('${type}', faker.helpers.arrayElement(['Dictionary', 'Encyclopedia', 'Guide', 'Handbook', 'Manual']))
      .replace('${subject}', faker.helpers.arrayElement(['Science', 'Mathematics', 'Literature', 'History', 'Art']))
      .replace('${at}', 'at')
      .replace('${ng}', 'ng')
      .replace('${sa}', 'sa')
      .replace('${tungkol}', 'tungkol');
  }

  /**
   * Generate a realistic author name
   */
  private generateRealisticAuthor(): string {
    const authorTypes = [
      () => faker.person.fullName(),
      () => `${faker.person.firstName()} ${faker.person.lastName()}, ${faker.person.firstName()} ${faker.person.lastName()}`,
      () => `${faker.person.firstName()} ${faker.person.lastName()} et al.`,
      () => `${faker.company.name()} Editorial Team`
    ];

    return BaseFactory.randomEnum(authorTypes)();
  }

  /**
   * Generate a Filipino author name
   */
  private generateFilipinoAuthor(): string {
    const filipinoNames = [
      'Jose Rizal', 'Nick Joaquin', 'Francisco Balagtas', 'Lualhati Bautista',
      'F. Sionil Jose', 'Catherine Lim', 'Bob Ong', 'Ambeth Ocampo',
      'Carlos Bulosan', 'Bienvenido Santos', 'Ninotchka Rosca', 'Jessica Zafra'
    ];
    
    return BaseFactory.randomBoolean(0.7) 
      ? BaseFactory.randomEnum(filipinoNames)
      : faker.person.fullName();
  }

  /**
   * Generate a Filipino title
   */
  private generateFilipinoTitle(): string {
    const filipinoTitles = [
      'Noli Me Tangere', 'El Filibusterismo', 'Florante at Laura', 'Ibong Adarna',
      'Biag ni Lam-ang', 'Dekada \'70', 'Bagong Barangay', 'Sa Mga Kuko ng Liwanag'
    ];
    
    return BaseFactory.randomBoolean(0.6)
      ? BaseFactory.randomEnum(filipinoTitles)
      : `Ang ${faker.helpers.arrayElement(['Pag-asa', 'Kalayaan', 'Pangarap', 'Pag-ibig', 'Bayan'])}`;
  }

  /**
   * Get random subcategory for a category
   */
  private getRandomSubcategory(category: string): string | null {
    const subcategories = BookFactory.BOOK_SUBCATEGORIES[category as keyof typeof BookFactory.BOOK_SUBCATEGORIES];
    return subcategories ? BaseFactory.randomEnum(subcategories) : null;
  }

  /**
   * Generate edition information
   */
  private generateEdition(): string | null {
    const editions = ['1st Edition', '2nd Edition', '3rd Edition', 'Revised Edition', 'Updated Edition'];
    return BaseFactory.randomBoolean(0.7) ? BaseFactory.randomEnum(editions) : null;
  }

  /**
   * Generate realistic page count
   */
  private generatePages(): string | null {
    const pageCount = BaseFactory.randomInt(50, 800);
    return pageCount.toString();
  }

  /**
   * Generate source of fund
   */
  private generateSourceOfFund(): string | null {
    const sources = ['School Budget', 'Donation', 'Government Grant', 'PTA Fund', 'Library Development Fund'];
    return BaseFactory.randomBoolean(0.8) ? BaseFactory.randomEnum(sources) : null;
  }
}