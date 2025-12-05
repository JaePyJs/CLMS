import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/authenticate';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/search
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const query = (req.query.q as string)?.trim();

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    try {
      // Use raw SQL with LOWER() for true case-insensitive search in SQLite
      const searchPattern = `%${query.toLowerCase()}%`;

      // Search Students using raw SQL for case-insensitive matching
      const students = await prisma.$queryRaw<any[]>`
        SELECT id, student_id, first_name, last_name, grade_level, section, is_active
        FROM students
        WHERE LOWER(first_name) LIKE ${searchPattern}
           OR LOWER(last_name) LIKE ${searchPattern}
           OR LOWER(student_id) LIKE ${searchPattern}
           OR LOWER(COALESCE(barcode, '')) LIKE ${searchPattern}
        LIMIT 10
      `;

      // Search Books using raw SQL
      const books = await prisma.$queryRaw<any[]>`
        SELECT id, title, author, isbn, accession_no, location, available_copies
        FROM books
        WHERE LOWER(title) LIKE ${searchPattern}
           OR LOWER(COALESCE(author, '')) LIKE ${searchPattern}
           OR LOWER(COALESCE(isbn, '')) LIKE ${searchPattern}
           OR LOWER(COALESCE(accession_no, '')) LIKE ${searchPattern}
        LIMIT 10
      `;

      // Search Equipment using raw SQL
      const equipment = await prisma.$queryRaw<any[]>`
        SELECT id, name, serial_number, category, status
        FROM equipment
        WHERE LOWER(name) LIKE ${searchPattern}
           OR LOWER(COALESCE(serial_number, '')) LIKE ${searchPattern}
           OR LOWER(COALESCE(category, '')) LIKE ${searchPattern}
        LIMIT 10
      `;

      // Transform results into a unified format
      const results = [
        ...students.slice(0, 5).map(s => ({
          type: 'student',
          id: s.id,
          title: `${s.first_name} ${s.last_name}`,
          subtitle: s.student_id,
          status: s.is_active ? 'Active' : 'Inactive',
          metadata: {
            grade: s.grade_level,
            section: s.section,
          },
        })),
        ...books.slice(0, 5).map(b => ({
          type: 'book',
          id: b.id,
          title: b.title,
          subtitle: b.author || 'Unknown Author',
          status: b.available_copies > 0 ? 'Available' : 'Out of Stock',
          metadata: {
            isbn: b.isbn,
            location: b.location,
          },
        })),
        ...equipment.slice(0, 5).map(e => ({
          type: 'equipment',
          id: e.id,
          title: e.name,
          subtitle: e.category || 'Equipment',
          status: e.status,
          metadata: {
            serial: e.serial_number,
          },
        })),
      ];

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      logger.error('Search error', { error, query });
      throw error;
    }
  }),
);

export default router;
