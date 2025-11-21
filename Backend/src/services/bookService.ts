/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

export interface CreateBookData {
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  accession_no: string;
  available_copies?: number;
  total_copies?: number;
  cost_price?: number;
  edition?: string;
  pages?: string;
  remarks?: string;
  source_of_fund?: string;
  volume?: string;
  year?: number;
  is_active?: boolean;
}

export interface UpdateBookData {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  category?: string;
  subcategory?: string;
  location?: string;
  available_copies?: number;
  total_copies?: number;
  cost_price?: number;
  edition?: string;
  pages?: string;
  remarks?: string;
  source_of_fund?: string;
  volume?: string;
  year?: number;
  is_active?: boolean;
}

export interface BookSearchFilters {
  search?: string;
  category?: string;
  author?: string;
  isbn?: string;
  available?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'title' | 'author' | 'publishedDate' | 'createdAt' | 'accession_no';
  sortOrder?: 'asc' | 'desc';
}

export interface BookAvailabilityInfo {
  available: boolean;
  total_copies: number;
  available_copies: number;
  borrowed_copies: number;
  reserved_copies?: number;
  next_available_date?: Date | null;
}

export class BookService {
  public static async createBook(data: CreateBookData): Promise<any> {
    try {
      logger.info('Creating book', {
        accession_no: data.accession_no,
        title: data.title,
        author: data.author,
      });

      const book = await prisma.books.create({
        data: {
          isbn: data.isbn ?? null,
          title: data.title,
          author: data.author,
          publisher: data.publisher ?? null,
          category: data.category,
          subcategory: data.subcategory ?? null,
          location: data.location ?? null,
          accession_no: data.accession_no,
          available_copies: data.available_copies || 1,
          total_copies: data.total_copies || 1,
          cost_price: data.cost_price ?? null,
          edition: data.edition ?? null,
          pages: data.pages ?? null,
          remarks: data.remarks ?? null,
          source_of_fund: data.source_of_fund ?? null,
          volume: data.volume ?? null,
          year: data.year ?? null,
          is_active: data.is_active !== undefined ? data.is_active : true,
        },
      });

      logger.info('Book created successfully', {
        bookId: book.id,
        accession_no: book.accession_no,
      });

      return book;
    } catch (error) {
      logger.error('Book creation failed', {
        accession_no: data.accession_no,
        title: data.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getBookById(id: string): Promise<any> {
    try {
      const book = await prisma.books.findUnique({
        where: { id },
        include: {
          checkouts: {
            where: { status: 'ACTIVE' },
            take: 1,
            orderBy: { due_date: 'asc' },
          },
        },
      });

      if (!book) {
        throw new Error('Book not found');
      }

      return book;
    } catch (error) {
      logger.error('Get book by ID failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async updateBook(
    id: string,
    data: UpdateBookData,
  ): Promise<any> {
    try {
      logger.info('Updating book', { id });

      // Check if we're updating copies and adjust availability
      if (
        data.total_copies !== undefined ||
        data.available_copies !== undefined
      ) {
        const currentBook = await prisma.books.findUnique({
          where: { id },
          include: {
            checkouts: {
              where: { status: 'ACTIVE' },
              select: { id: true },
            },
          },
        });

        if (currentBook) {
          const newTotalCopies =
            data.total_copies !== undefined
              ? data.total_copies
              : currentBook.total_copies;
          const newAvailableCopies =
            data.available_copies !== undefined
              ? data.available_copies
              : currentBook.available_copies;

          if (newAvailableCopies > newTotalCopies) {
            throw new Error('Available copies cannot exceed total copies');
          }

          // Update available copies based on borrowed books
          const borrowedCount = currentBook.checkouts.length;
          const calculatedAvailable = newTotalCopies - borrowedCount;

          // Only update available_copies if it wasn't explicitly provided or if it needs to be recalculated
          if (
            data.available_copies === undefined ||
            data.available_copies !== currentBook.available_copies
          ) {
            data.available_copies = calculatedAvailable;
          }
        }
      }

      const book = await prisma.books.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });

      logger.info('Book updated successfully', {
        id,
        accession_no: book.accession_no,
      });
      return book;
    } catch (error) {
      logger.error('Book update failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async deleteBook(id: string): Promise<void> {
    try {
      logger.info('Deleting book', { id });

      // Delete all related checkouts first (both active and returned)
      await prisma.book_checkouts.deleteMany({
        where: { book_id: id },
      });

      // Now delete the book
      await prisma.books.delete({ where: { id } });
      logger.info('Book deleted successfully', { id });
    } catch (error) {
      logger.error('Book deletion failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async listBooks(
    filters: BookSearchFilters = {},
  ): Promise<{ books: any[]; total: number; page: number; limit: number }> {
    try {
      const {
        search,
        category,
        author,
        isbn,
        available,
        page: rawPage = 1,
        limit: rawLimit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      // Parse page and limit as integers
      const page =
        typeof rawPage === 'string' ? parseInt(rawPage, 10) : rawPage;
      const limit =
        typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : rawLimit;

      const where: any = {};

      // Build search conditions
      if (search) {
        where.OR = [
          { title: { contains: search } },
          { author: { contains: search } },
          { isbn: { contains: search } },
          { accession_no: { contains: search } },
        ];
      }

      if (category) {
        where.category = { contains: category };
      }

      if (author) {
        where.author = { contains: author };
      }

      if (isbn) {
        where.isbn = isbn;
      }

      if (available !== undefined) {
        where.available_copies = available ? { gt: 0 } : 0;
      }

      // Handle sorting
      const orderBy: any = {};
      if (sortBy === 'publishedDate') {
        orderBy.year = sortOrder;
      } else if (sortBy === 'createdAt') {
        orderBy.created_at = sortOrder;
      } else if (sortBy === 'accession_no') {
        orderBy.accession_no = sortOrder;
      } else {
        orderBy[sortBy] = sortOrder;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await prisma.books.count({ where });

      // Get books with pagination and sorting
      const books = await prisma.books.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              checkouts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      });

      logger.info('Books list retrieved', {
        total,
        count: books.length,
        page,
        limit,
      });

      return {
        books,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('List books failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getBookAvailability(
    id: string,
  ): Promise<BookAvailabilityInfo> {
    try {
      const book = await prisma.books.findUnique({
        where: { id },
        include: {
          checkouts: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              due_date: true,
              return_date: true,
            },
            orderBy: { due_date: 'asc' },
          },
        },
      });

      if (!book) {
        throw new Error('Book not found');
      }

      const borrowedCopies = book.checkouts.length;
      const availableCopies = book.available_copies;
      const totalCopies = book.total_copies;

      // Find next available date (earliest due date)
      let nextAvailableDate: Date | null = null;
      if (borrowedCopies > 0) {
        const earliestDueDate = book.checkouts[0].due_date;
        nextAvailableDate = earliestDueDate;
      }

      return {
        available: availableCopies > 0,
        total_copies: totalCopies,
        available_copies: availableCopies,
        borrowed_copies: borrowedCopies,
        next_available_date: nextAvailableDate,
      };
    } catch (error) {
      logger.error('Get book availability failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getBookStats(): Promise<{
    total: number;
    available: number;
    checkedOut: number;
    overdue: number;
    categories: number;
  }> {
    try {
      const [totalBooks, availableBooks, categoriesResult, activeCheckouts] =
        await Promise.all([
          // Total books
          prisma.books.count({ where: { is_active: true } }),

          // Available books (with at least 1 copy available)
          prisma.books.count({
            where: {
              is_active: true,
              available_copies: { gt: 0 },
            },
          }),

          // Unique categories
          prisma.books.findMany({
            where: { is_active: true },
            select: { category: true },
            distinct: ['category'],
          }),

          // Active checkouts
          prisma.book_checkouts.count({
            where: { status: 'ACTIVE' },
          }),
        ]);

      // Count overdue checkouts
      const now = new Date();
      const overdueCheckouts = await prisma.book_checkouts.count({
        where: {
          status: 'ACTIVE',
          due_date: { lt: now },
        },
      });

      return {
        total: totalBooks,
        available: availableBooks,
        checkedOut: activeCheckouts,
        overdue: overdueCheckouts,
        categories: categoriesResult.length,
      };
    } catch (error) {
      logger.error('Get book stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async searchBooks(
    query: string,
    filters: Partial<BookSearchFilters> = {},
  ): Promise<{ books: any[]; total: number }> {
    logger.error('searchBooks called with query:', query);
    try {
      const {
        category,
        author,
        isbn,
        available,
        page = 1,
        limit = 10,
        sortBy = 'title',
        sortOrder = 'asc',
      } = filters;
      const searchQuery = (query || '').toLowerCase();

      const where: any = {
        OR: [
          { title: { contains: searchQuery } },
          { author: { contains: searchQuery } },
          { isbn: { contains: searchQuery } },
          { accession_no: { contains: searchQuery } },
          { category: { contains: searchQuery } },
          { publisher: { contains: searchQuery } },
        ],
      };

      if (category) {
        where.category = { contains: (category || '').toLowerCase() };
      }

      if (author) {
        where.author = { contains: (author || '').toLowerCase() };
      }

      if (isbn) {
        where.isbn = isbn;
      }

      if (available !== undefined) {
        where.available_copies = available ? { gt: 0 } : 0;
      }

      const skip = (page - 1) * limit;
      const total = await prisma.books.count({ where });

      const orderBy: any = {};
      if (sortBy === 'publishedDate') {
        orderBy.year = sortOrder;
      } else if (sortBy === 'createdAt') {
        orderBy.created_at = sortOrder;
      } else if (sortBy === 'accession_no') {
        orderBy.accession_no = sortOrder;
      } else {
        orderBy[sortBy] = sortOrder;
      }

      const books = await prisma.books.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              checkouts: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      });

      logger.info('Books search completed', {
        query,
        total,
        count: books.length,
      });

      return { books, total };
    } catch (error) {
      logger.error('Search books failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getCategories(): Promise<{
    categories: string[];
    categoriesWithCount: any[];
  }> {
    try {
      // Get unique categories
      const categories = await prisma.books.findMany({
        where: { is_active: true },
        select: { category: true },
        distinct: ['category'],
      });

      // Get categories with book counts
      const categoriesWithCount = await prisma.books.groupBy({
        by: ['category'],
        where: { is_active: true },
        _count: {
          id: true,
        },
        orderBy: {
          category: 'asc',
        },
      });

      const categoryList = categories
        .map(c => c.category)
        .filter((cat): cat is string => cat !== null)
        .sort();

      logger.info('Categories retrieved', { count: categoryList.length });

      return {
        categories: categoryList,
        categoriesWithCount: categoriesWithCount.map(c => ({
          category: c.category,
          bookCount: c._count.id,
        })),
      };
    } catch (error) {
      logger.error('Get categories failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async getBookHistory(
    id: string,
    filters: {
      page?: number;
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<any> {
    try {
      const { page = 1, limit = 10, dateFrom, dateTo } = filters;

      const where: any = { book_id: id };

      if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) {
          where.created_at.gte = dateFrom;
        }
        if (dateTo) {
          where.created_at.lte = dateTo;
        }
      }

      const skip = (page - 1) * limit;
      const total = await prisma.book_checkouts.count({ where });

      const history = await prisma.book_checkouts.findMany({
        where,
        include: {
          student: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
            },
          },
        },
        orderBy: { checkout_date: 'desc' },
        skip,
        take: limit,
      });

      logger.info('Book history retrieved', {
        bookId: id,
        total,
        count: history.length,
      });

      return {
        history,
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('Get book history failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Quality Management Methods
  public static async getQualityStats(): Promise<{
    total: number;
    needsReview: number;
    tempBarcodes: number;
    complete: number;
  }> {
    try {
      const [total, needsReview, tempBarcodes] = await Promise.all([
        prisma.books.count(),
        prisma.books.count({ where: { needs_review: true } as any }),
        prisma.books.count({
          where: { accession_no: { startsWith: 'TEMP-' } },
        }),
      ]);

      const complete = total - needsReview;

      return {
        total,
        needsReview,
        tempBarcodes,
        complete,
      };
    } catch (error) {
      logger.error('Get quality stats failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async markReviewed(id: string): Promise<any> {
    try {
      logger.info('Marking book as reviewed', { bookId: id });

      const book = await prisma.books.update({
        where: { id },
        data: {
          needs_review: false,
          import_notes: null,
        } as any,
      });

      logger.info('Book marked as reviewed successfully', { bookId: id });
      return book;
    } catch (error) {
      logger.error('Mark as reviewed failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public static async exportIncomplete(): Promise<string> {
    try {
      logger.info('Exporting incomplete books');

      const books = await prisma.books.findMany({
        where: { needs_review: true } as any,
        orderBy: { created_at: 'desc' },
        select: {
          accession_no: true,
          title: true,
          author: true,
          publisher: true,
          isbn: true,
          category: true,
          year: true,
          import_notes: true,
        },
      });

      // Generate CSV manually
      const headers = [
        'Barcode',
        'Title',
        'Author',
        'Publisher',
        'ISBN',
        'Category',
        'Year',
        'Issues',
      ];

      const rows = books.map(book => [
        book.accession_no,
        `"${(book.title || '').replace(/"/g, '""')}"`,
        `"${(book.author || '').replace(/"/g, '""')}"`,
        `"${(book.publisher || '').replace(/"/g, '""')}"`,
        book.isbn || '',
        book.category || '',
        book.year || '',
        `"${(book.import_notes || '').replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      logger.info('Export complete', { count: books.length });
      return csv;
    } catch (error) {
      logger.error('Export incomplete books failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
