import { prisma } from '@/utils/prisma';
import { logger } from '@/utils/logger';
import { CheckoutStatus } from '@prisma/client';

// Get all books with optional filtering
export async function getBooks(
  options: {
    category?: string;
    subcategory?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  } = {},
) {
  try {
    const {
      category,
      subcategory,
      isActive,
      page = 1,
      limit = 50,
      search,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { accessionNo: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
      }),
      prisma.book.count({ where }),
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
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        checkouts: {
          where: { status: CheckoutStatus.ACTIVE },
          orderBy: { checkoutDate: 'desc' },
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
export async function getBookByAccessionNo(accessionNo: string) {
  try {
    const book = await prisma.book.findUnique({
      where: { accessionNo },
      include: {
        checkouts: {
          where: { status: CheckoutStatus.ACTIVE },
          orderBy: { checkoutDate: 'desc' },
          take: 1,
        },
      },
    });

    return book;
  } catch (error) {
    logger.error('Error fetching book by accession number', {
      error: (error as Error).message,
      accessionNo,
    });
    throw error;
  }
}

// Get book by ISBN
export async function getBookByIsbn(isbn: string) {
  try {
    const book = await prisma.book.findUnique({
      where: { isbn },
      include: {
        checkouts: {
          where: { status: CheckoutStatus.ACTIVE },
          orderBy: { checkoutDate: 'desc' },
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
  accessionNo: string;
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
    const book = await prisma.book.create({
      data: {
        isbn: data.isbn || null,
        accessionNo: data.accessionNo,
        title: data.title,
        author: data.author,
        publisher: data.publisher || null,
        category: data.category,
        subcategory: data.subcategory || null,
        location: data.location || null,
        totalCopies: data.totalCopies || 1,
        availableCopies: data.availableCopies || data.totalCopies || 1,
      },
    });

    logger.info('Book created successfully', { accessionNo: book.accessionNo });
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
    const book = await prisma.book.update({
      where: { id },
      data,
    });

    logger.info('Book updated successfully', { bookId: id });
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
    await prisma.book.delete({
      where: { id },
    });

    logger.info('Book deleted successfully', { bookId: id });
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
  bookId: string;
  studentId: string;
  dueDate: Date;
  notes?: string;
}) {
  try {
    // Check if book is available
    const book = await prisma.book.findUnique({
      where: { id: data.bookId },
    });

    if (!book) {
      throw new Error('Book not found');
    }

    if (book.availableCopies <= 0) {
      throw new Error('No copies available for checkout');
    }

    // Create checkout record
    const checkout = await prisma.bookCheckout.create({
      data: {
        bookId: data.bookId,
        studentId: data.studentId,
        checkoutDate: new Date(),
        dueDate: data.dueDate,
        notes: data.notes || null,
        status: CheckoutStatus.ACTIVE,
        processedBy: 'System',
      },
      include: {
        book: {
          select: {
            accessionNo: true,
            title: true,
            author: true,
          },
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update available copies
    await prisma.book.update({
      where: { id: data.bookId },
      data: {
        availableCopies: {
          decrement: 1,
        },
      },
    });

    logger.info('Book checked out successfully', {
      checkoutId: checkout.id,
      bookId: data.bookId,
      studentId: data.studentId,
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
export async function returnBook(checkoutId: string) {
  try {
    const checkout = await prisma.bookCheckout.findUnique({
      where: { id: checkoutId },
      include: {
        book: true,
      },
    });

    if (!checkout) {
      throw new Error('Checkout record not found');
    }

    if (checkout.status !== CheckoutStatus.ACTIVE) {
      throw new Error('Book is already returned');
    }

    const returnDate = new Date();

    // Calculate overdue days and fine
    let overdueDays = 0;
    let fineAmount = 0;

    if (returnDate > checkout.dueDate) {
      overdueDays = Math.ceil(
        (returnDate.getTime() - checkout.dueDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      // Calculate fine (1 peso per day, configurable)
      fineAmount = overdueDays * 1.0;
    }

    // Update checkout record
    const updatedCheckout = await prisma.bookCheckout.update({
      where: { id: checkoutId },
      data: {
        returnDate,
        status: CheckoutStatus.RETURNED,
        overdueDays,
        fineAmount,
      },
      include: {
        book: {
          select: {
            accessionNo: true,
            title: true,
            author: true,
          },
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update available copies
    await prisma.book.update({
      where: { id: checkout.bookId },
      data: {
        availableCopies: {
          increment: 1,
        },
      },
    });

    logger.info('Book returned successfully', {
      checkoutId,
      bookId: checkout.bookId,
      overdueDays,
      fineAmount,
    });

    return updatedCheckout;
  } catch (error) {
    logger.error('Error returning book', {
      error: (error as Error).message,
      checkoutId,
    });
    throw error;
  }
}

// Get book checkouts
export async function getBookCheckouts(
  options: {
    bookId?: string;
    studentId?: string;
    status?: CheckoutStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {},
) {
  try {
    const {
      bookId,
      studentId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (bookId) {
      where.bookId = bookId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.checkoutDate = {};
      if (startDate) where.checkoutDate.gte = startDate;
      if (endDate) where.checkoutDate.lte = endDate;
    }

    const [checkouts, total] = await Promise.all([
      prisma.bookCheckout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkoutDate: 'desc' },
        include: {
          book: {
            select: {
              accessionNo: true,
              title: true,
              author: true,
              category: true,
            },
          },
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              gradeLevel: true,
              gradeCategory: true,
            },
          },
        },
      }),
      prisma.bookCheckout.count({ where }),
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
    const overdueCheckouts = await prisma.bookCheckout.findMany({
      where: {
        status: CheckoutStatus.ACTIVE,
        dueDate: {
          lt: new Date(),
        },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        book: {
          select: {
            accessionNo: true,
            title: true,
            author: true,
            category: true,
          },
        },
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            gradeLevel: true,
            gradeCategory: true,
          },
        },
      },
    });

    // Calculate overdue days for each checkout
    const today = new Date();
    const overdueBooks = overdueCheckouts.map(checkout => {
      const overdueDays = Math.ceil(
        (today.getTime() - checkout.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        ...checkout,
        overdueDays,
        fineAmount: overdueDays * 1.0,
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
