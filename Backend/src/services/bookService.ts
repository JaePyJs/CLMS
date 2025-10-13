import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { Prisma, book_checkouts_status } from '@prisma/client';

export interface GetBooksOptions {
  category?: string;
  subcategory?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetBookCheckoutsOptions {
  book_id?: string;
  student_id?: string;
  status?: typeof book_checkouts_status;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

// Get all books with optional filtering
export async function getBooks(options: GetBooksOptions = {}) {
  try {
    const {
      category,
      subcategory,
      is_active,
      page = 1,
      limit = 50,
      search,
    } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.booksWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
        { accession_no: { contains: search } },
        { isbn: { contains: search } },
      ];
    }

    const [books, total] = await Promise.all([
      prisma.books.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
      }),
      prisma.books.count({ where }),
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
    logger.error('Error fetching books', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get book by ID
export async function getBookById(id: string) {
  try {
    const book = await prisma.books.findUnique({
      where: { id },
      include: {
        book_checkouts: {
          where: { status: 'ACTIVE' },
          orderBy: { checkout_date: 'desc' },
          take: 1,
        },
      },
    });

    return book;
  } catch (error) {
    logger.error('Error fetching book by ID', {
      error: (error as Error).message,
      id,
    });
    throw error;
  }
}

// Get book by accession number
export async function getBookByAccessionNo(accession_no: string) {
  try {
    const book = await prisma.books.findUnique({
      where: { accession_no: accession_no },
      include: {
        book_checkouts: {
          where: { status: 'ACTIVE' },
          orderBy: { checkout_date: 'desc' },
          take: 1,
        },
      },
    });

    return book;
  } catch (error) {
    logger.error('Error fetching book by accession number', {
      error: (error as Error).message,
      accession_no,
    });
    throw error;
  }
}

// Get book by ISBN (returns first match since ISBN is not unique)
export async function getBookByIsbn(isbn: string) {
  try {
    const book = await prisma.books.findFirst({
      where: { isbn },
      include: {
        book_checkouts: {
          where: { status: 'ACTIVE' },
          orderBy: { checkout_date: 'desc' },
          take: 1,
        },
      },
    });

    return book;
  } catch (error) {
    logger.error('Error fetching book by ISBN', {
      error: (error as Error).message,
      isbn,
    });
    throw error;
  }
}

// Create new book
export async function createBook(data: { 
  isbn?: string;
  accession_no: string;
  title: string;
  author: string;
  publisher?: string;
  category: string;
  subcategory?: string;
  location?: string;
  totalCopies?: number;
  availableCopies?: number;
}) {
  try {
    const book = await prisma.books.create({
      data: { 
        id: `book-${Date.now()}`,
        updated_at: new Date(),
        isbn: data.isbn || null,
        accession_no: data.accession_no,
        title: data.title,
        author: data.author,
        publisher: data.publisher || null,
        category: data.category,
        subcategory: data.subcategory || null,
        location: data.location || null,
        total_copies: data.total_copies || 1,
        available_copies: data.available_copies || data.total_copies || 1,
      },
    });

    logger.info('Book created successfully', { accession_no: book.accession_no });
    return book;
  } catch (error) {
    logger.error('Error creating book', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Update book
export async function updateBook(
  id: string,
  data: { 
    isbn?: string;
    accessionNo?: string;
    title?: string;
    author?: string;
    publisher?: string;
    category?: string;
    subcategory?: string;
    location?: string;
    totalCopies?: number;
    availableCopies?: number;
    isActive?: boolean;
  },
) {
  try {
    const book = await prisma.books.update({
      where: { id },
      data,
    });

    logger.info('Book updated successfully', { book_id: id });
    return book;
  } catch (error) {
    logger.error('Error updating book', {
      error: (error as Error).message,
      id,
      data,
    });
    throw error;
  }
}

// Delete book
export async function deleteBook(id: string) {
  try {
    await prisma.books.delete({
      where: { id },
    });

    logger.info('Book deleted successfully', { book_id: id });
    return true;
  } catch (error) {
    logger.error('Error deleting book', {
      error: (error as Error).message,
      id,
    });
    throw error;
  }
}

// Check out book
export async function checkoutBook(data: { 
  book_id: string;
  student_id: string;
  due_date: Date;
  notes?: string;
}) {
  try {
    // Check if book is available
    const book = await prisma.books.findUnique({
      where: { id: data.book_id },
    });

    if (!book) {
      throw new Error('Book not found');
    }

    if (book.available_copies <= 0) {
      throw new Error('No copies available for checkout');
    }

    // Create checkout record
    const checkout = await prisma.book_checkouts.create({
      data: { 
        id: `checkout-${Date.now()}`,
        updated_at: new Date(),
        book_id: data.book_id,
        student_id: data.student_id,
        checkout_date: new Date(),
        due_date: data.due_date,
        notes: data.notes || null,
        status: 'ACTIVE',
        processed_by: 'System',
      },
      include: {
        books: {
          select: {
            accession_no: true,
            title: true,
            author: true,
          },
        },
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Update available copies
    await prisma.books.update({
      where: { id: data.book_id },
      data: { 
        available_copies: {
          decrement: 1,
        },
      },
    });

    logger.info('Book checked out successfully', {
      checkout_id: checkout.id,
      book_id: data.book_id,
      student_id: data.student_id,
    });

    return checkout;
  } catch (error) {
    logger.error('Error checking out book', {
      error: (error as Error).message,
      data,
    });
    throw error;
  }
}

// Return book
export async function returnBook(checkout_id: string) {
  try {
    const checkout = await prisma.book_checkouts.findUnique({
      where: { id: checkout_id },
      include: {
        books: true,
      },
    });

    if (!checkout) {
      throw new Error('Checkout record not found');
    }

    if (checkout.status !== 'ACTIVE') {
      throw new Error('Book is already returned');
    }

    const returnDate = new Date();

    // Calculate overdue days and fine
    let overdueDays = 0;
    let fineAmount = 0;

    if (returnDate > checkout.due_date) {
      overdueDays = Math.ceil(
        (returnDate.getTime() - checkout.due_date.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      // Calculate fine (1 peso per day, configurable)
      fineAmount = overdueDays * 1.0;
    }

    // Update checkout record
    const updatedCheckout = await prisma.book_checkouts.update({
      where: { id: checkout_id },
      data: { 
        return_date: return_date,
        status: 'RETURNED',
        overdue_days: overdue_days,
        fine_amount: fine_amount,
      },
      include: {
        books: {
          select: {
            accession_no: true,
            title: true,
            author: true,
          },
        },
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    // Update available copies
    await prisma.books.update({
      where: { id: checkout.book_id },
      data: { 
        available_copies: {
          increment: 1,
        },
      },
    });

    logger.info('Book returned successfully', {
      checkout_id,
      book_id: checkout.book_id,
      overdue_days,
      fine_amount,
    });

    return updatedCheckout;
  } catch (error) {
    logger.error('Error returning book', {
      error: (error as Error).message,
      checkout_id,
    });
    throw error;
  }
}

// Get book checkouts
export async function getBookCheckouts(options: GetBookCheckoutsOptions = {}) {
  try {
    const {
      book_id,
      student_id,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.book_checkoutsWhereInput = {};

    if (book_id) {
      where.book_id = book_id;
    }

    if (student_id) {
      where.student_id = student_id;
    }

    if (status) {
      where.status = status as any;
    }

    if (startDate || endDate) {
      where.checkout_date = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const [checkouts, total] = await Promise.all([
      prisma.book_checkouts.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkout_date: 'desc' },
        include: {
          books: {
            select: {
              accession_no: true,
              title: true,
              author: true,
              category: true,
            },
          },
          students: {
            select: {
              student_id: true,
              first_name: true,
              last_name: true,
              grade_level: true,
              grade_category: true,
            },
          },
        },
      }),
      prisma.book_checkouts.count({ where }),
    ]);

    return {
      checkouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching book checkouts', {
      error: (error as Error).message,
      options,
    });
    throw error;
  }
}

// Get overdue books
export async function getOverdueBooks() {
  try {
    const overdueCheckouts = await prisma.book_checkouts.findMany({
      where: {
        status: 'ACTIVE',
        due_date: {
          lt: new Date(),
        },
      },
      orderBy: { due_date: 'asc' },
      include: {
        books: {
          select: {
            accession_no: true,
            title: true,
            author: true,
            category: true,
          },
        },
        students: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            grade_category: true,
          },
        },
      },
    });

    // Calculate overdue days for each checkout
    const today = new Date();
    const overdueBooks = overdueCheckouts.map(checkout => {
      const overdueDays = Math.ceil(
        (today.getTime() - checkout.due_date.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        ...checkout,
        overdue_days,
        fine_amount: overdueDays * 1.0,
      };
    });

    return overdueBooks;
  } catch (error) {
    logger.error('Error fetching overdue books', {
      error: (error as Error).message,
    });
    throw error;
  }
}
