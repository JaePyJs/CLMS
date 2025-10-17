import { Prisma, books, book_checkouts_status } from '@prisma/client';
import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { BaseRepository } from './base.repository';

/**
 * Books Repository
 * 
 * Extends BaseRepository to provide book-specific operations with flexible
 * ID handling for accession_no (external book identifier).
 */
export class BooksRepository extends BaseRepository<
  books,
  Prisma.booksCreateInput,
  Prisma.booksUpdateInput
> {
  constructor() {
    super(prisma, 'books', 'accession_no');
  }

  /**
   * Find a book by accession number
   */
  async findByAccessionNo(accession_no: string): Promise<books | null> {
    try {
      const book = await this.getModel().findUnique({
        where: { accession_no },
        include: {
          book_checkouts: {
            where: { status: book_checkouts_status.ACTIVE },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
        },
      });

      return book;
    } catch (error) {
      this.handleDatabaseError(error, 'findByAccessionNo', { accession_no });
    }
  }

  /**
   * Find a book by ISBN (returns first match since ISBN is not unique)
   */
  async findByIsbn(isbn: string): Promise<books | null> {
    try {
      const book = await this.getModel().findFirst({
        where: { isbn },
        include: {
          book_checkouts: {
            where: { status: book_checkouts_status.ACTIVE },
            orderBy: { checkout_date: 'desc' },
            take: 1,
          },
        },
      });

      return book;
    } catch (error) {
      this.handleDatabaseError(error, 'findByIsbn', { isbn });
    }
  }

  /**
   * Create a new book with automatic field population
   */
  async createBook(data: {
    isbn?: string;
    accession_no: string;
    title: string;
    author: string;
    publisher?: string;
    category: string;
    subcategory?: string;
    location?: string;
    total_copies?: number;
    available_copies?: number;
    cost_price?: number;
    edition?: string;
    pages?: string;
    remarks?: string;
    source_of_fund?: string;
    volume?: string;
    year?: number;
  }): Promise<books> {
    try {
      const processedData = this.populateMissingFields({
        isbn: data.isbn || null,
        accession_no: data.accession_no,
        title: data.title.trim(),
        author: data.author.trim(),
        publisher: data.publisher?.trim() || null,
        category: data.category.trim(),
        subcategory: data.subcategory?.trim() || null,
        location: data.location?.trim() || null,
        total_copies: data.total_copies || 1,
        available_copies: data.available_copies || data.total_copies || 1,
        cost_price: data.cost_price || null,
        edition: data.edition?.trim() || null,
        pages: data.pages?.trim() || null,
        remarks: data.remarks?.trim() || null,
        source_of_fund: data.source_of_fund?.trim() || null,
        volume: data.volume?.trim() || null,
        year: data.year || null,
        is_active: true,
      });

      const book = await this.getModel().create({
        data: processedData,
      });

      logger.info('Book created successfully', {
        id: book.id,
        accession_no: book.accession_no,
        title: book.title,
        author: book.author,
      });

      return book;
    } catch (error) {
      // Handle unique constraint violation for accession_no
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as any)?.find((field: string) => 
          field.includes('accession_no')
        );
        
        if (target) {
          throw new Error(`Book with accession number '${data.accession_no}' already exists`);
        }
      }

      this.handleDatabaseError(error, 'createBook', {
        accession_no: data.accession_no,
        title: data.title,
        author: data.author,
      });
    }
  }

  /**
   * Upsert a book by accession number (ideal for imports)
   */
  async upsertByAccessionNo(
    accession_no: string,
    data: {
      isbn?: string;
      title: string;
      author: string;
      publisher?: string;
      category: string;
      subcategory?: string;
      location?: string;
      total_copies?: number;
      available_copies?: number;
      cost_price?: number;
      edition?: string;
      pages?: string;
      remarks?: string;
      source_of_fund?: string;
      volume?: string;
      year?: number;
      is_active?: boolean;
    }
  ): Promise<books> {
    try {
      const whereClause = { accession_no };

      const createData = this.populateMissingFields({
        isbn: data.isbn || null,
        accession_no,
        title: data.title.trim(),
        author: data.author.trim(),
        publisher: data.publisher?.trim() || null,
        category: data.category.trim(),
        subcategory: data.subcategory?.trim() || null,
        location: data.location?.trim() || null,
        total_copies: data.total_copies || 1,
        available_copies: data.available_copies || data.total_copies || 1,
        cost_price: data.cost_price || null,
        edition: data.edition?.trim() || null,
        pages: data.pages?.trim() || null,
        remarks: data.remarks?.trim() || null,
        source_of_fund: data.source_of_fund?.trim() || null,
        volume: data.volume?.trim() || null,
        year: data.year || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      });

      const updateData = {
        ...(data.isbn !== undefined && { isbn: data.isbn || null }),
        ...(data.title && { title: data.title.trim() }),
        ...(data.author && { author: data.author.trim() }),
        ...(data.publisher !== undefined && { publisher: data.publisher?.trim() || null }),
        ...(data.category && { category: data.category.trim() }),
        ...(data.subcategory !== undefined && { subcategory: data.subcategory?.trim() || null }),
        ...(data.location !== undefined && { location: data.location?.trim() || null }),
        ...(data.total_copies !== undefined && { total_copies: data.total_copies }),
        ...(data.available_copies !== undefined && { available_copies: data.available_copies }),
        ...(data.cost_price !== undefined && { cost_price: data.cost_price || null }),
        ...(data.edition !== undefined && { edition: data.edition?.trim() || null }),
        ...(data.pages !== undefined && { pages: data.pages?.trim() || null }),
        ...(data.remarks !== undefined && { remarks: data.remarks?.trim() || null }),
        ...(data.source_of_fund !== undefined && { source_of_fund: data.source_of_fund?.trim() || null }),
        ...(data.volume !== undefined && { volume: data.volume?.trim() || null }),
        ...(data.year !== undefined && { year: data.year || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        updated_at: new Date(),
      };

      const book = await this.getModel().upsert({
        where: whereClause,
        create: createData,
        update: updateData,
      });

      const isCreated = book.created_at.getTime() === book.updated_at.getTime();
      
      logger.info(`Book ${isCreated ? 'created' : 'updated'} successfully via upsert`, {
        id: book.id,
        accession_no: book.accession_no,
        title: book.title,
        author: book.author,
        action: isCreated ? 'created' : 'updated',
      });

      return book;
    } catch (error) {
      this.handleDatabaseError(error, 'upsertByAccessionNo', {
        accession_no,
        title: data.title,
        author: data.author,
      });
    }
  }

  /**
   * Get books with flexible filtering options
   */
  async getBooks(options: {
    category?: string;
    subcategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    author?: string;
    publisher?: string;
    year?: number;
    availableOnly?: boolean;
  } = {}): Promise<{
    books: books[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        category,
        subcategory,
        isActive,
        page = 1,
        limit = 50,
        search,
        author,
        publisher,
        year,
        availableOnly = false,
      } = options;

      const skip = (page - 1) * limit;
      const where: Prisma.booksWhereInput = {};

      // Apply filters
      if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }

      if (subcategory) {
        where.subcategory = { contains: subcategory, mode: 'insensitive' };
      }

      if (isActive !== undefined) {
        where.is_active = isActive;
      }

      if (author) {
        where.author = { contains: author, mode: 'insensitive' };
      }

      if (publisher) {
        where.publisher = { contains: publisher, mode: 'insensitive' };
      }

      if (year) {
        where.year = year;
      }

      if (availableOnly) {
        where.available_copies = { gt: 0 };
      }

      // Apply search across multiple fields
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { accession_no: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
          { publisher: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [books, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy: { title: 'asc' },
        }),
        this.getModel().count({ where }),
      ]);

      return {
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, 'getBooks', options);
    }
  }

  /**
   * Search books by multiple criteria with advanced filtering
   */
  async searchBooks(criteria: {
    query?: string;
    category?: string;
    author?: string;
    publisher?: string;
    yearRange?: { from?: number; to?: number };
    availableOnly?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'title' | 'author' | 'year' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    books: books[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const {
        query,
        category,
        author,
        publisher,
        yearRange,
        availableOnly = false,
        page = 1,
        limit = 50,
        sortBy = 'title',
        sortOrder = 'asc',
      } = criteria;

      const skip = (page - 1) * limit;
      const where: Prisma.booksWhereInput = {};

      // Build search conditions
      const andConditions: Prisma.booksWhereInput[] = [];

      if (query) {
        andConditions.push({
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { author: { contains: query, mode: 'insensitive' } },
            { accession_no: { contains: query, mode: 'insensitive' } },
            { isbn: { contains: query, mode: 'insensitive' } },
            { publisher: { contains: query, mode: 'insensitive' } },
          ],
        });
      }

      if (category) {
        andConditions.push({
          OR: [
            { category: { contains: category, mode: 'insensitive' } },
            { subcategory: { contains: category, mode: 'insensitive' } },
          ],
        });
      }

      if (author) {
        andConditions.push({
          author: { contains: author, mode: 'insensitive' }
        });
      }

      if (publisher) {
        andConditions.push({
          publisher: { contains: publisher, mode: 'insensitive' }
        });
      }

      if (yearRange) {
        const yearFilter: Prisma.IntFilter = {};
        if (yearRange.from !== undefined) {
          yearFilter.gte = yearRange.from;
        }
        if (yearRange.to !== undefined) {
          yearFilter.lte = yearRange.to;
        }
        if (Object.keys(yearFilter).length > 0) {
          andConditions.push({ year: yearFilter });
        }
      }

      if (availableOnly) {
        andConditions.push({
          available_copies: { gt: 0 }
        });
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      // Build order by clause
      const orderBy: Prisma.booksOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      const [books, total] = await Promise.all([
        this.getModel().findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
        this.getModel().count({ where }),
      ]);

      return {
        books,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleDatabaseError(error, 'searchBooks', criteria);
    }
  }

  /**
   * Update book availability (increment/decrement available copies)
   */
  async updateAvailability(
    accession_no: string,
    change: number,
    operation: 'increment' | 'decrement' = 'increment'
  ): Promise<books | null> {
    try {
      const book = await this.getModel().update({
        where: { accession_no },
        data: {
          available_copies: {
            [operation]: Math.abs(change),
          },
          updated_at: new Date(),
        },
      });

      logger.info(`Book availability updated`, {
        accession_no,
        operation,
        change,
        new_available_copies: book.available_copies,
      });

      return book;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        logger.warn('Attempted to update availability for non-existent book', {
          accession_no,
        });
        return null;
      }

      this.handleDatabaseError(error, 'updateAvailability', {
        accession_no,
        change,
        operation,
      });
    }
  }

  /**
   * Get book categories with counts
   */
  async getCategoriesWithCounts(): Promise<{ category: string; count: number }[]> {
    try {
      const categories = await this.getModel().groupBy({
        by: ['category'],
        _count: {
          category: true,
        },
        where: {
          is_active: true,
        },
        orderBy: {
          category: 'asc',
        },
      });

      return categories.map(item => ({
        category: item.category,
        count: item._count.category,
      }));
    } catch (error) {
      this.handleDatabaseError(error, 'getCategoriesWithCounts');
    }
  }

  /**
   * Bulk upsert books for import operations
   */
  async bulkUpsertBooks(
    booksData: Array<{
      accession_no: string;
      title: string;
      author: string;
      isbn?: string;
      publisher?: string;
      category: string;
      subcategory?: string;
      location?: string;
      total_copies?: number;
      available_copies?: number;
      cost_price?: number;
      edition?: string;
      pages?: string;
      remarks?: string;
      source_of_fund?: string;
      volume?: string;
      year?: number;
    }>
  ): Promise<{
    successful: books[];
    failed: Array<{ accession_no: string; error: string }>;
    summary: { created: number; updated: number; failed: number };
  }> {
    const successful: books[] = [];
    const failed: Array<{ accession_no: string; error: string }> = [];
    let created = 0;
    let updated = 0;

    logger.info('Starting bulk upsert operation for books', {
      totalBooks: booksData.length,
    });

    for (const bookData of booksData) {
      try {
        const existingBook = await this.findByAccessionNo(bookData.accession_no);
        
        const book = await this.upsertByAccessionNo(bookData.accession_no, bookData);
        successful.push(book);

        if (!existingBook) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        failed.push({
          accession_no: bookData.accession_no,
          error: errorMessage,
        });

        logger.warn('Failed to upsert book during bulk operation', {
          accession_no: bookData.accession_no,
          error: errorMessage,
        });
      }
    }

    const summary = { created, updated, failed: failed.length };

    logger.info('Bulk upsert operation completed', {
      ...summary,
      totalProcessed: booksData.length,
    });

    return {
      successful,
      failed,
      summary,
    };
  }

  /**
   * Validate book data before creation/update
   */
  private validateBookData(data: any): void {
    if (!data.accession_no || data.accession_no.trim().length === 0) {
      throw new Error('Accession number is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Book title is required');
    }

    if (!data.author || data.author.trim().length === 0) {
      throw new Error('Book author is required');
    }

    if (!data.category || data.category.trim().length === 0) {
      throw new Error('Book category is required');
    }

    if (data.total_copies !== undefined && data.total_copies < 0) {
      throw new Error('Total copies cannot be negative');
    }

    if (data.available_copies !== undefined && data.available_copies < 0) {
      throw new Error('Available copies cannot be negative');
    }

    if (data.year !== undefined && (data.year < 1000 || data.year > new Date().getFullYear() + 10)) {
      throw new Error('Invalid publication year');
    }
  }

  /**
   * Override create method to include validation
   */
  async create(data: Prisma.booksCreateInput): Promise<books> {
    this.validateBookData(data);
    return super.create(data);
  }

  /**
   * Override update methods to include validation
   */
  async updateById(id: string, data: Prisma.booksUpdateInput): Promise<books | null> {
    this.validateBookData(data);
    return super.updateById(id, data);
  }

  async updateByExternalId(accession_no: string, data: Prisma.booksUpdateInput): Promise<books | null> {
    this.validateBookData(data);
    return super.updateByExternalId(accession_no, data);
  }
}

// Export singleton instance
export const booksRepository = new BooksRepository();