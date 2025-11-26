import type { books, book_checkouts } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { websocketServer } from '../websocket/websocketServer';
import { ScanExportService } from './scanExportService';

export type BookScanIntent = 'BORROW' | 'READ' | 'RETURN';

export interface BookScanPayload {
  intent: BookScanIntent;
  studentId?: string;
  dueDate?: string;
  notes?: string;
  librarianId?: string;
}

export interface BookScanResult {
  success: boolean;
  message: string;
  intent?: BookScanIntent;
  book?: books;
  checkout?: book_checkouts;
  activityId?: string;
  dueDate?: string;
}

export class BookScanService {
  public static async handleScan(
    barcode: string,
    payload: BookScanPayload,
  ): Promise<BookScanResult> {
    const intent = payload.intent;
    if (!intent) {
      return { success: false, message: 'Intent is required for book scans' };
    }

    const book = await this.findBook(barcode);
    if (!book) {
      return { success: false, message: 'Book not found for this barcode' };
    }

    try {
      if (intent === 'BORROW') {
        return await this.handleBorrow(book, barcode, payload);
      }
      if (intent === 'READ') {
        return await this.handleReadingSession(book, barcode, payload);
      }
      return await this.handleReturn(book, barcode, payload);
    } catch (error) {
      logger.error('Book scan handling failed', {
        intent,
        barcode,
        error: error instanceof Error ? error.message : error,
      });
      return { success: false, message: 'Failed to process book scan' };
    }
  }

  private static async handleBorrow(
    book: books,
    barcode: string,
    payload: BookScanPayload,
  ): Promise<BookScanResult> {
    if (!payload.studentId) {
      return {
        success: false,
        message: 'Student ID is required to borrow a book',
      };
    }

    const student = await prisma.students.findUnique({
      where: { id: payload.studentId },
    });

    if (!student) {
      return { success: false, message: 'Student not found' };
    }

    if ((book.available_copies ?? 0) <= 0) {
      return {
        success: false,
        message: 'No available copies for this book',
      };
    }

    const dueDate = payload.dueDate
      ? new Date(payload.dueDate)
      : this.defaultDueDate();

    const checkout = await prisma.book_checkouts.create({
      data: {
        student_id: student.id,
        book_id: book.id,
        due_date: dueDate,
        status: 'ACTIVE',
        notes: payload.notes,
      },
      include: {
        student: true,
        book: true,
      },
    });

    await prisma.books.update({
      where: { id: book.id },
      data: {
        available_copies: { decrement: 1 },
      },
    });

    await prisma.student_activities.create({
      data: {
        student_id: student.id,
        activity_type: 'BOOK_BORROWED',
        description: `Borrowed "${book.title}"`,
        status: 'COMPLETED',
        metadata: {
          checkoutId: checkout.id,
          barcode,
          dueDate: dueDate.toISOString(),
        },
      },
    });

    websocketServer.emitBorrowReturnUpdate({
      type: 'checkout',
      studentId: student.id,
      bookId: book.id,
      dueDate: dueDate.toISOString(),
      fineAmount: 0,
      status: 'ACTIVE',
    });

    ScanExportService.logBookAction({
      barcode,
      bookId: book.id,
      bookTitle: book.title,
      intent: 'BORROW',
      studentId: student.student_id,
      studentName: `${student.first_name} ${student.last_name}`,
      dueDate: dueDate.toISOString(),
      notes: payload.notes,
    }).catch(error =>
      logger.error('Failed to log book borrow export', {
        bookId: book.id,
        error: error instanceof Error ? error.message : error,
      }),
    );

    return {
      success: true,
      message: 'Book borrowed successfully',
      intent: 'BORROW',
      book,
      checkout,
      dueDate: dueDate.toISOString(),
    };
  }

  private static async handleReadingSession(
    book: books,
    barcode: string,
    payload: BookScanPayload,
  ): Promise<BookScanResult> {
    if (!payload.studentId) {
      return {
        success: false,
        message: 'Student ID is required to log reading sessions',
      };
    }

    const student = await prisma.students.findUnique({
      where: { id: payload.studentId },
    });

    if (!student) {
      return { success: false, message: 'Student not found' };
    }

    const activity = await prisma.student_activities.create({
      data: {
        student_id: student.id,
        activity_type: 'BOOK_READING_SESSION',
        description: `Reading "${book.title}" inside library`,
        status: 'COMPLETED',
        metadata: {
          bookId: book.id,
          barcode,
          notes: payload.notes,
        },
      },
    });

    websocketServer.emitReadingSession({
      studentId: student.id,
      bookId: book.id,
      bookTitle: book.title,
      startTime: activity.start_time.toISOString(),
    });

    ScanExportService.logBookAction({
      barcode,
      bookId: book.id,
      bookTitle: book.title,
      intent: 'READ',
      studentId: student.student_id,
      studentName: `${student.first_name} ${student.last_name}`,
      notes: payload.notes || 'Library reading session',
    }).catch(error =>
      logger.error('Failed to log reading session export', {
        bookId: book.id,
        error: error instanceof Error ? error.message : error,
      }),
    );

    return {
      success: true,
      message: 'Reading session logged',
      intent: 'READ',
      book,
      activityId: activity.id,
    };
  }

  private static async handleReturn(
    book: books,
    barcode: string,
    payload: BookScanPayload,
  ): Promise<BookScanResult> {
    const studentFilter = payload.studentId
      ? { student_id: payload.studentId }
      : {};

    const checkout = await prisma.book_checkouts.findFirst({
      where: {
        book_id: book.id,
        status: 'ACTIVE',
        ...studentFilter,
      },
      orderBy: { checkout_date: 'desc' },
      include: {
        student: true,
      },
    });

    if (!checkout) {
      return { success: false, message: 'No active checkout found for book' };
    }

    const now = new Date();

    const updatedCheckout = await prisma.book_checkouts.update({
      where: { id: checkout.id },
      data: {
        status: 'RETURNED',
        return_date: now,
        notes: payload.notes,
      },
    });

    await prisma.books.update({
      where: { id: book.id },
      data: {
        available_copies: { increment: 1 },
      },
    });

    await prisma.student_activities.create({
      data: {
        student_id: checkout.student_id,
        activity_type: 'BOOK_RETURNED',
        description: `Returned "${book.title}"`,
        status: 'COMPLETED',
        metadata: {
          checkoutId: checkout.id,
          barcode,
          notes: payload.notes,
        },
      },
    });

    websocketServer.emitBorrowReturnUpdate({
      type: 'return',
      studentId: checkout.student_id,
      bookId: book.id,
      dueDate: checkout.due_date.toISOString(),
      fineAmount: updatedCheckout.fine_amount || 0,
      status: 'RETURNED',
    });

    ScanExportService.logBookAction({
      barcode,
      bookId: book.id,
      bookTitle: book.title,
      intent: 'RETURN',
      studentId: checkout.student?.student_id,
      studentName: checkout.student
        ? `${checkout.student.first_name} ${checkout.student.last_name}`
        : undefined,
      notes: payload.notes,
    }).catch(error =>
      logger.error('Failed to log book return export', {
        bookId: book.id,
        error: error instanceof Error ? error.message : error,
      }),
    );

    return {
      success: true,
      message: 'Book returned successfully',
      intent: 'RETURN',
      book,
      checkout: updatedCheckout,
    };
  }

  private static async findBook(barcode: string) {
    const normalized = barcode.trim();
    return prisma.books.findFirst({
      where: {
        OR: [
          { accession_no: normalized },
          { isbn: normalized },
          { id: normalized },
        ],
      },
    });
  }

  private static defaultDueDate() {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    return due;
  }
}
