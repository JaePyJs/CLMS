import { prisma } from '../utils/prisma';
import { ProcessedBorrowingRecord } from '../services/googleSheetsService';

export class BorrowingRepository {
  private static instance: BorrowingRepository;

  private constructor() {}

  public static getInstance(): BorrowingRepository {
    if (!BorrowingRepository.instance) {
      BorrowingRepository.instance = new BorrowingRepository();
    }
    return BorrowingRepository.instance;
  }

  /**
   * Bulk insert borrowing history.
   * Links to existing students and books if possible.
   */
  public async bulkInsertBorrowingHistory(
    records: ProcessedBorrowingRecord[],
  ): Promise<number> {
    let insertedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      await prisma.$transaction(async tx => {
        for (const record of batch) {
          // 1. Find Student
          const student = await tx.students.findUnique({
            where: { student_id: record.studentId },
          });

          if (!student) {
            // Skip if student not found (data integrity)
            continue;
          }

          // 2. Find Book
          const book = await tx.books.findFirst({
            where: { title: record.bookTitle },
          });

          if (!book) {
            // Skip if book not found (could potentially create placeholder, but strict for now)
            continue;
          }

          // 3. Check for Duplicate (same student, same book, same borrow date)
          const existing = await tx.book_checkouts.findFirst({
            where: {
              student_id: student.id,
              book_id: book.id,
              checkout_date: record.borrowDate,
            },
          });

          if (existing) {
            continue;
          }

          // 4. Create Record
          await tx.book_checkouts.create({
            data: {
              student_id: student.id,
              book_id: book.id,
              checkout_date: record.borrowDate,
              return_date: record.returnedDate,
              due_date:
                record.returnedDate ||
                new Date(record.borrowDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Default 7 days if return date not provided? Or make optional
              status: record.status || 'ACTIVE',
            },
          });
          insertedCount++;
        }
      });
    }

    return insertedCount;
  }

  /**
   * Get borrowing records for export
   */
  public async getBorrowingHistoryForExport(
    startDate: Date,
    endDate: Date,
  ): Promise<ProcessedBorrowingRecord[]> {
    const records = await prisma.book_checkouts.findMany({
      where: {
        checkout_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        student: {
          select: {
            student_id: true,
            first_name: true,
            last_name: true,
            grade_level: true,
            section: true,
            type: true,
            gender: true,
          },
        },
        book: {
          select: {
            title: true,
            author: true,
            location: true,
            accession_no: true,
          },
        },
      },
      orderBy: {
        checkout_date: 'desc',
      },
    });

    return records.map(r => ({
      timestamp: r.checkout_date,
      studentId: r.student?.student_id || '',
      surname: r.student?.last_name || 'Unknown',
      firstName: r.student?.first_name || 'Unknown',
      gradeLevel: r.student?.grade_level
        ? `GRADE ${r.student.grade_level}`
        : '',
      section: r.student?.section || '',
      designation: r.student?.type || '',
      sex: r.student?.gender || '',
      action: 'Borrow',
      bookTitle: r.book?.title || 'Unknown',
      bookAuthor: r.book?.author || '',
      callNumber: r.book?.location || r.book?.accession_no || '',
      borrowDate: r.checkout_date,
      dueDate: r.due_date,
      returnedDate: r.return_date || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: (r.status === 'ACTIVE' ? 'BORROWED' : r.status) as any,
      fine: r.fine_amount ? r.fine_amount.toString() : undefined,
      remarks: r.notes || undefined,
    }));
  }
}

export const borrowingRepository = BorrowingRepository.getInstance();
